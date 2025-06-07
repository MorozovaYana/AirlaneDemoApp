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
    }

    return 0;
}



