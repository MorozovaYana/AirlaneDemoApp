-- Create a flight status table
CREATE TABLE IF NOT EXISTS FlightStatus (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL
);

-- Flight statuses (basic values)
INSERT INTO FlightStatus (name) VALUES 
('Planned'),
('Departed'),
('Arrived'),
('Canceled'),
('Detained')
ON CONFLICT DO NOTHING;

-- Table of airports
CREATE TABLE IF NOT EXISTS Airports (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    code VARCHAR(10) UNIQUE NOT NULL,
    city VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL
);

-- Table of airplanes
CREATE TABLE IF NOT EXISTS Planes (
    id SERIAL PRIMARY KEY,
    model VARCHAR(50) NOT NULL,
    capacity INT NOT NULL CHECK (capacity > 0),
    manufacturer VARCHAR(100) NOT NULL
);

-- Table of flights
CREATE TABLE IF NOT EXISTS Flights (
    id SERIAL PRIMARY KEY,
    plane_id INT NOT NULL REFERENCES Planes(id),
    departure_airport INT NOT NULL REFERENCES Airports(id),
    arrival_airport INT NOT NULL REFERENCES Airports(id),
    departure_time TIMESTAMP NOT NULL,
    arrival_time TIMESTAMP NOT NULL,
    status INT NOT NULL REFERENCES FlightStatus(id) DEFAULT 1,
    CHECK (arrival_time > departure_time)
);

-- Passenger table (updated version)
CREATE TABLE IF NOT EXISTS Passengers (
    id SERIAL PRIMARY KEY,
    full_name TEXT NOT NULL,
    email TEXT UNIQUE,
    phone VARCHAR(20)
);

-- Employee table
CREATE TABLE IF NOT EXISTS Employees (
    id SERIAL PRIMARY KEY,
    full_name VARCHAR(100) NOT NULL,
    role VARCHAR(50) NOT NULL,
    flight_id INT REFERENCES Flights(id)
);

-- Booking table (updated version)
CREATE TABLE IF NOT EXISTS Bookings (
    id SERIAL PRIMARY KEY,
    passenger_id INT NOT NULL REFERENCES Passengers(id),
    flight_id INT NOT NULL REFERENCES Flights(id),
    seat_number TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'Booked',
    booking_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Ticket table
CREATE TABLE IF NOT EXISTS Tickets (
    id SERIAL PRIMARY KEY,
    booking_id INT NOT NULL REFERENCES Bookings(id),
    seat VARCHAR(10) NOT NULL,
    price NUMERIC(8,2) NOT NULL CHECK (price >= 0),
    status VARCHAR(50) NOT NULL DEFAULT 'Active'
);

-- Table of payments
CREATE TABLE IF NOT EXISTS Payments (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES Tickets(id),
    amount NUMERIC(8,2) NOT NULL CHECK (amount >= 0),
    payment_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    method VARCHAR(50) NOT NULL
);

-- Table of registrations
CREATE TABLE IF NOT EXISTS CheckIns (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES Tickets(id),
    checkin_time TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gate VARCHAR(10) NOT NULL
);

-- Baggage table 
CREATE TABLE IF NOT EXISTS Luggage (
    id SERIAL PRIMARY KEY,
    ticket_id INT NOT NULL REFERENCES Tickets(id),
    weight NUMERIC(5,2) NOT NULL CHECK (weight > 0),
    type VARCHAR(50) NOT NULL
);

-- Table of discounts
CREATE TABLE IF NOT EXISTS Discounts (
    id SERIAL PRIMARY KEY,
    code VARCHAR(20) UNIQUE NOT NULL,
    description TEXT,
    amount NUMERIC(5,2) NOT NULL CHECK (amount >= 0),
    is_percent BOOLEAN NOT NULL DEFAULT FALSE
);

-- Log table
CREATE TABLE IF NOT EXISTS Logs (
    id SERIAL PRIMARY KEY,
    action VARCHAR(100) NOT NULL,
    timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    user_email VARCHAR(100),
    details TEXT
);

-- Additional indices to improve performance
CREATE INDEX IF NOT EXISTS idx_flights_departure ON 
Flights(departure_time);
CREATE INDEX IF NOT EXISTS idx_flights_status ON Flights(status);
CREATE INDEX IF NOT EXISTS idx_bookings_passenger ON 
Bookings(passenger_id);
CREATE INDEX IF NOT EXISTS idx_bookings_flight ON Bookings(flight_id);
CREATE INDEX IF NOT EXISTS idx_tickets_booking ON Tickets(booking_id);


--------------------------------

-- Adding airports
INSERT INTO Airports (name, code, city, country) VALUES
('Boryspil', 'KBP', 'Kyiv', 'Ukraine'),
('Heathrow', 'LHR', 'London', 'United Kingdom'),
('Charles de Gaulle', 'CDG', 'Paris', 'France');

--  Adding planes
INSERT INTO Planes (model, capacity, manufacturer) VALUES
('Boeing 737', 180, 'Boeing'),
('Airbus A320', 150, 'Airbus'),
('Embraer E190', 100, 'Embraer');

-- Adding flights
INSERT INTO Flights (plane_id, departure_airport, arrival_airport, departure_time, arrival_time, status) 
VALUES
(1, 1, 2, '2025-06-15 08:00:00', '2025-06-15 10:30:00', 1),
(2, 2, 3, '2025-06-16 12:00:00', '2025-06-16 14:15:00', 1),
(3, 1, 3, '2025-06-17 18:30:00', '2025-06-17 21:00:00', 1);

--------------------------------

-- Search flights by route (Kyiv-London)
SELECT f.id, a1.city AS "From", a2.city AS "To", f.departure_time 
FROM Flights f
JOIN Airports a1 ON f.departure_airport = a1.id
JOIN Airports a2 ON f.arrival_airport = a2.id
WHERE a1.code = 'KBP' AND a2.code = 'LHR';

-- Search passengers by surname
SELECT * FROM Passengers 
WHERE full_name LIKE '%Ivano%';

--  Active bookings for a specific flight
SELECT p.full_name, b.seat_number 
FROM Bookings b
JOIN Passengers p ON b.passenger_id = p.id
WHERE b.flight_id = 1 AND b.status = 'Booked';

-- Flights with available seats (assuming plane capacity is 180)
SELECT f.id, a1.city AS departure, a2.city AS arrival, 
       (SELECT capacity FROM Planes WHERE id = f.plane_id) - 
       (SELECT COUNT(*) FROM Bookings WHERE flight_id = f.id) AS available_seats
FROM Flights f
JOIN Airports a1 ON f.departure_airport = a1.id
JOIN Airports a2 ON f.arrival_airport = a2.id;

-- Flight load report
SELECT 
    f.id,
    a1.city || ' → ' || a2.city AS route,
    COUNT(b.id) AS booked_seats,
    p.capacity,
    ROUND(COUNT(b.id) * 100.0 / p.capacity, 2) AS load_percent
FROM Flights f
JOIN Airports a1 ON f.departure_airport = a1.id
JOIN Airports a2 ON f.arrival_airport = a2.id
JOIN Planes p ON f.plane_id = p.id
LEFT JOIN Bookings b ON f.id = b.flight_id AND b.status = 'Booked'
GROUP BY f.id, a1.city, a2.city, p.capacity;

-- Revenue report for flights (assuming all tickets cost 5000)
SELECT 
    f.id,
    a1.city || ' → ' || a2.city AS route,
    COUNT(t.id) * 5000 AS total_revenue
FROM Flights f
JOIN Airports a1 ON f.departure_airport = a1.id
JOIN Airports a2 ON f.arrival_airport = a2.id
JOIN Bookings b ON f.id = b.flight_id
JOIN Tickets t ON b.id = t.booking_id
GROUP BY f.id, a1.city, a2.city;

--------------------------------
-- Feature: Automatic discount by code

CREATE OR REPLACE FUNCTION apply_discount(ticket_id INT, discount_code VARCHAR)
RETURNS VOID AS $$
DECLARE
    discount_record RECORD;
    price_before NUMERIC;
BEGIN
    SELECT * INTO discount_record FROM Discounts WHERE code = discount_code;
    IF NOT FOUND THEN
        RAISE NOTICE 'Discount code not found';
        RETURN;
    END IF;

    SELECT price INTO price_before FROM Tickets WHERE id = ticket_id;

    IF discount_record.is_percent THEN
        UPDATE Tickets
        SET price = price_before - (price_before * discount_record.amount / 100)
        WHERE id = ticket_id;
    ELSE
        UPDATE Tickets
        SET price = GREATEST(0, price_before - discount_record.amount)
        WHERE id = ticket_id;
    END IF;

    INSERT INTO Logs(action, user_email, details)
    VALUES('Apply Discount', NULL, 'Ticket ID: ' || ticket_id || ', Code: ' || discount_code);
END;
$$ LANGUAGE plpgsql;

-- Trigger: Logging of new bookings
CREATE OR REPLACE FUNCTION log_booking_insert()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO Logs(action, user_email, details)
    VALUES ('New Booking', NULL, 'Passenger ID: ' || NEW.passenger_id || ', Flight ID: ' || NEW.flight_id);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_log_booking
AFTER INSERT ON Bookings
FOR EACH ROW
EXECUTE FUNCTION log_booking_insert();


-- Trigger: Flight overflow check (max 105%)

CREATE OR REPLACE FUNCTION check_overbooking()
RETURNS TRIGGER AS $$
DECLARE
    total_booked INT;
    max_capacity INT;
BEGIN
   
    SELECT p.capacity INTO max_capacity
    FROM Flights f
    JOIN Planes p ON f.plane_id = p.id
    WHERE f.id = NEW.flight_id;

    IF max_capacity IS NULL THEN
        RAISE EXCEPTION 'Flight or plane not found for flight_id: %', NEW.flight_id;
    END IF;


    SELECT COUNT(*) + 1 INTO total_booked
    FROM Bookings
    WHERE flight_id = NEW.flight_id;


    IF total_booked > CEIL(max_capacity * 1.05) THEN
        RAISE EXCEPTION 'Flight is overbooked beyond 105%% (Booked: %, Allowed: %)', total_booked, CEIL(max_capacity * 1.05);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


CREATE TRIGGER trg_check_overbooking
BEFORE INSERT ON Bookings
FOR EACH ROW
EXECUTE FUNCTION check_overbooking();


-- Procedure: Create a flight with all the parameters
CREATE OR REPLACE PROCEDURE create_flight(
    p_plane_id INT,
    p_dep_airport INT,
    p_arr_airport INT,
    p_dep_time TIMESTAMP,
    p_arr_time TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    INSERT INTO Flights(plane_id, departure_airport, arrival_airport, departure_time, arrival_time, status)
    VALUES(p_plane_id, p_dep_airport, p_arr_airport, p_dep_time, p_arr_time, 1);

    INSERT INTO Logs(action, user_email, details)
    VALUES('Create Flight', NULL, 'Plane ID: ' || p_plane_id);
END;
$$;

-- Feature: Clean old logs

CREATE OR REPLACE FUNCTION cleanup_old_logs(days_old INT)
RETURNS INT AS $$
DECLARE
    deleted_count INT;
BEGIN
    DELETE FROM Logs
    WHERE timestamp < NOW() - (days_old || ' days')::INTERVAL
    RETURNING * INTO deleted_count;
    
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;



