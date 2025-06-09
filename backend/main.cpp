#include <iostream>
#include <sstream>
#include <string>
#include <cstring>
#include <unistd.h>
#include <netinet/in.h>
#include <libpq-fe.h>

void send_response(int client, const std::string& body) {
    std::ostringstream response;
    response << "HTTP/1.1 200 OK\r\n"
             << "Content-Type: application/json\r\n"
             << "Access-Control-Allow-Origin: *\r\n"
             << "Access-Control-Allow-Methods: GET, POST, OPTIONS\r\n"
             << "Access-Control-Allow-Headers: Content-Type\r\n"
             << "Content-Length: " << body.size() << "\r\n\r\n"
             << body;
    send(client, response.str().c_str(), response.str().size(), 0);
}

std::string url_decode(const std::string& str) {
    std::string decoded;
    char a, b;
    for (size_t i = 0; i < str.size(); ++i) {
        if ((str[i] == '%') && i + 2 < str.size()) {
            a = str[i + 1];
            b = str[i + 2];
            a = (a <= '9') ? a - '0' : toupper(a) - 'A' + 10;
            b = (b <= '9') ? b - '0' : toupper(b) - 'A' + 10;
            decoded += (a << 4) | b;
            i += 2;
        } else if (str[i] == '+') {
            decoded += ' ';
        } else {
            decoded += str[i];
        }
    }
    return decoded;
}

std::string get_value(const std::string& data, const std::string& key) {
    auto pos = data.find(key + "=");
    if (pos == std::string::npos) return "";
    auto start = pos + key.length() + 1;
    auto end = data.find("&", start);
    return url_decode(data.substr(start, end - start));
}

void handle_options(int client) {
    std::string response = "HTTP/1.1 200 OK\r\n"
                          "Access-Control-Allow-Origin: *\r\n"
                          "Access-Control-Allow-Methods: POST, GET, OPTIONS\r\n"
                          "Access-Control-Allow-Headers: Content-Type\r\n"
                          "Content-Length: 0\r\n\r\n";
    send(client, response.c_str(), response.size(), 0);
}

void handle_request(int client, const std::string& body) {
    std::string name = get_value(body, "passenger_name");
    std::string email = get_value(body, "email");
    std::string flight_id = get_value(body, "flight_id");
    std::string seat = get_value(body, "seat");

    PGconn* conn = PQconnectdb("dbname=airlanedb user=postgres password=postgres host=db port=5435");
    if (PQstatus(conn) != CONNECTION_OK) {
        send_response(client, "Database connection failed.");
        PQfinish(conn);
        return;
    }

    std::string insert = "INSERT INTO Passengers (full_name, email) VALUES ('" + name + "', '" + email + "') RETURNING id";
    PGresult* res1 = PQexec(conn, insert.c_str());
    if (PQresultStatus(res1) != PGRES_TUPLES_OK) {
        send_response(client, "Failed to insert passenger.");
        PQclear(res1); PQfinish(conn); return;
    }
    std::string passenger_id = PQgetvalue(res1, 0, 0);
    PQclear(res1);

    std::string insertBooking = "INSERT INTO Bookings (passenger_id, flight_id, seat_number, status) VALUES (" + passenger_id + ", " + flight_id + ", '" + seat + "', 'Booked')";
    PGresult* res2 = PQexec(conn, insertBooking.c_str());
    if (PQresultStatus(res2) != PGRES_COMMAND_OK) {
        send_response(client, "Booking failed.");
        PQclear(res2); PQfinish(conn); return;
    }

    PQclear(res2);
    PQfinish(conn);
    send_response(client, "Booking successful for " + name + " on flight " + flight_id);
}

void handle_airports_request(int client) {
    PGconn* conn = PQconnectdb("dbname=airlanedb user=postgres password=postgres host=db port=5432");
    if (PQstatus(conn) != CONNECTION_OK) {
        send_response(client, "Database connection failed");
        PQfinish(conn);
        return;
    }

    PGresult* res = PQexec(conn, "SELECT id, name, code, city, country FROM Airports");
    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        send_response(client, "Error fetching airports");
        PQclear(res);
        PQfinish(conn);
        return;
    }

    std::string json = "[";
    for (int i = 0; i < PQntuples(res); i++) {
        if (i > 0) json += ",";
        json += "{";
        json += "\"id\":" + std::string(PQgetvalue(res, i, 0)) + ",";
        json += "\"name\":\"" + std::string(PQgetvalue(res, i, 1)) + "\",";
        json += "\"code\":\"" + std::string(PQgetvalue(res, i, 2)) + "\",";
        json += "\"city\":\"" + std::string(PQgetvalue(res, i, 3)) + "\",";
        json += "\"country\":\"" + std::string(PQgetvalue(res, i, 4)) + "\"";
        json += "}";
    }
    json += "]";

    PQclear(res);
    PQfinish(conn);
    send_response(client, json);
}

void handle_flights_request(int client, const std::string& departure_id, const std::string& arrival_id, const std::string& date) {
    PGconn* conn = PQconnectdb("dbname=airlanedb user=postgres password=postgres host=db port=5432");
    if (PQstatus(conn) != CONNECTION_OK) {
        send_response(client, "{\"error\":\"Database connection failed\"}");
        PQfinish(conn);
        return;
    }

    std::string query = R"(
        SELECT 
            f.id, 
            p.model as plane_model, 
            p.capacity as plane_capacity,
            dep.name as departure_name, 
            dep.code as departure_code, 
            dep.city as departure_city,
            arr.name as arrival_name, 
            arr.code as arrival_code, 
            arr.city as arrival_city,
            TO_CHAR(f.departure_time, 'YYYY-MM-DD HH24:MI:SS') as departure_time,
            TO_CHAR(f.arrival_time, 'YYYY-MM-DD HH24:MI:SS') as arrival_time,
            fs.name as status_name,
            (SELECT COUNT(*) FROM Bookings WHERE flight_id = f.id AND status = 'Booked') as booked_seats
        FROM Flights f
        JOIN Planes p ON f.plane_id = p.id
        JOIN Airports dep ON f.departure_airport = dep.id
        JOIN Airports arr ON f.arrival_airport = arr.id
        JOIN FlightStatus fs ON f.status = fs.id
        WHERE f.departure_airport = )" + departure_id + R"(
        AND f.arrival_airport = )" + arrival_id + R"(
        AND DATE(f.departure_time) = ')" + date + R"('
        ORDER BY f.departure_time
    )";

    PGresult* res = PQexec(conn, query.c_str());
    if (PQresultStatus(res) != PGRES_TUPLES_OK) {
        send_response(client, "{\"error\":\"Error fetching flights: " + std::string(PQerrorMessage(conn)) + "\"}");
        PQclear(res);
        PQfinish(conn);
        return;
    }

    std::ostringstream json;
    json << "[";
    for (int i = 0; i < PQntuples(res); i++) {
        if (i > 0) json << ",";
        json << "{"
             << "\"id\":" << PQgetvalue(res, i, 0) << ","
             << "\"plane\":{"
             << "\"model\":\"" << PQgetvalue(res, i, 1) << "\","
             << "\"capacity\":" << PQgetvalue(res, i, 2) << "},"
             << "\"departure_airport\":{"
             << "\"name\":\"" << PQgetvalue(res, i, 3) << "\","
             << "\"code\":\"" << PQgetvalue(res, i, 4) << "\","
             << "\"city\":\"" << PQgetvalue(res, i, 5) << "\"},"
             << "\"arrival_airport\":{"
             << "\"name\":\"" << PQgetvalue(res, i, 6) << "\","
             << "\"code\":\"" << PQgetvalue(res, i, 7) << "\","
             << "\"city\":\"" << PQgetvalue(res, i, 8) << "\"},"
             << "\"departure_time\":\"" << PQgetvalue(res, i, 9) << "\","
             << "\"arrival_time\":\"" << PQgetvalue(res, i, 10) << "\","
             << "\"status\":\"" << PQgetvalue(res, i, 11) << "\","
             << "\"available_seats\":" << (std::stoi(PQgetvalue(res, i, 2)) - std::stoi(PQgetvalue(res, i, 12))) << ","
             << "\"booked_seats\":" << PQgetvalue(res, i, 12)
             << "}";
    }
    json << "]";

    PQclear(res);
    PQfinish(conn);
    send_response(client, json.str());
}

int main() {
    int server_fd, client;
    struct sockaddr_in address;
    int addrlen = sizeof(address);
    char buffer[4096] = {0};

    server_fd = socket(AF_INET, SOCK_STREAM, 0);
    int opt = 1;
    setsockopt(server_fd, SOL_SOCKET, SO_REUSEADDR, &opt, sizeof(opt));

    address.sin_family = AF_INET;
    address.sin_addr.s_addr = INADDR_ANY;
    address.sin_port = htons(8080);
    bind(server_fd, (struct sockaddr*)&address, sizeof(address));
    listen(server_fd, 3);

    

    std::cout << "Server running on http://localhost:8080\n";

     
    while (true) {
        client = accept(server_fd, (struct sockaddr*)&address, (socklen_t*)&addrlen);
        memset(buffer, 0, 4096);
        read(client, buffer, 4096);
        std::string request(buffer);
        
        // Handle OPTIONS request for CORS preflight
        if (request.find("OPTIONS") != std::string::npos) {
            handle_options(client);
            close(client);
            continue;
        }

        if (request.find("GET /airports") != std::string::npos) {
    handle_airports_request(client);
    close(client);
    continue;
}


    if (request.find("GET http://localhost:8080/airports") != std::string::npos) {
        handle_airports_request(client);
        close(client);
        continue;
    }

        
        auto pos = request.find("\r\n\r\n");
        if (pos != std::string::npos) {
            std::string body = request.substr(pos + 4);
            handle_request(client, body);
        }
        close(client);

        if (request.find("GET /flights") != std::string::npos) {
    
    size_t params_start = request.find('?');
    if (params_start != std::string::npos) {
        std::string params_str = request.substr(params_start + 1);
        std::istringstream params_stream(params_str);
        std::string param;
        std::string departure_id, arrival_id, date;

        while (std::getline(params_stream, param, '&')) {
            size_t eq_pos = param.find('=');
            if (eq_pos != std::string::npos) {
                std::string key = param.substr(0, eq_pos);
                std::string value = param.substr(eq_pos + 1);
                
                if (key == "departure") departure_id = value;
                else if (key == "arrival") arrival_id = value;
                else if (key == "date") date = value;
            }
        }

        if (!departure_id.empty() && !arrival_id.empty() && !date.empty()) {
            handle_flights_request(client, departure_id, arrival_id, date);
            close(client);
            continue;
        }
    }
    send_response(client, "{\"error\":\"Missing parameters. Required: departure, arrival, date\"}");
    close(client);
    continue;
}
    }

    

    return 0;
}

