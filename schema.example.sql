-- this file is just an example for the real schema.sql file, so that the
-- appuser database password is protected (not exposed on the internet)

-- schema.sql - Creates the SensorBoard database, a limited user, and
--              the readings table.

CREATE DATABASE IF NOT EXISTS appdb;

CREATE USER IF NOT EXISTS 'appuser'@'localhost' IDENTIFIED BY '[REDACTED]';
GRANT SELECT, INSERT ON appdb.* TO 'appuser'@'localhost';
FLUSH PRIVILEGES;

USE appdb;

CREATE TABLE IF NOT EXISTS readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL,
    value DOUBLE NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_device_time (device_id, created_at)
);
