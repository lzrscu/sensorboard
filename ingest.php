<?php 
header('Content-Type: application/json');

// helper function: send JSON response with a status code and stop.
function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body);
    exit;
}

$config_file = __DIR__ . '/config.php';
if (!is_file($config_file)) {
    error_log('ingest.php: config.php is missing');
    respond(500, ['error' => 'Server not configured']);
}
$config = require $config_file;

// accept only POST requests.
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(405, ['error' => 'Use POST']);
}

$key = $_SERVER['HTTP_X_API_KEY'] ?? '';
if (!hash_equals($config['api_key'], $key)) {
    respond(401, ['error' => 'Invalid API key']);
}

$data = json_decode(file_get_contents('php://input'), true);
if (!is_array($data)) {
    respond(400, ['error' => 'Body must be valid JSON']);
}

$device_id = trim((string)($data['device_id'] ?? ''));
$sensor_type = trim((string)($data['sensor_type'] ?? ''));
$value = $data['value'] ?? null;

if ($device_id == '' || $sensor_type == '' || !is_numeric($value)) {
    respond(422, ['error' => 'Need device_id, sensor_type and a numeric value']);
}

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'],
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );
    $stmt = $pdo->prepare(
        'INSERT INTO readings (device_id, sensor_type, value) VALUES (?, ?, ?)'
    );
    $stmt->execute([$device_id, $sensor_type, (float)$value]);
    respond(201, ['status' => 'ok', 'id' => (int)$pdo->lastInsertId()]);
} catch (PDOException $e) {
    error_log('ingest.php DB error: ' . $e->getMessage());
    respond(500, ['error' => 'Database error']);
}
