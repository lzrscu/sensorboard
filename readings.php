<?php
header('Content-Type: application/json');
header('Cache-Control: no-store');

function respond(int $code, array $body): void {
    http_response_code($code);
    echo json_encode($body);
    exit;
}

$configFile = __DIR__ . '/config.php';
if (!is_file($configFile)) {
    error_log('readings.php: config.php is missing');
    respond(500, ['error' => 'Server not configured']);
}
$config = require $configFile;

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    respond(405, ['error' => 'Use GET']);
}

$device  = trim((string)($_GET['device'] ?? ''));
$limit   = max(1, min(500, (int)($_GET['limit'] ?? 50)));
$after_id = max(0, (int)($_GET['after_id'] ?? 0));

try {
    $pdo = new PDO(
        'mysql:host=' . $config['db_host'] . ';dbname=' . $config['db_name'],
        $config['db_user'],
        $config['db_pass'],
        [
            PDO::ATTR_ERRMODE          => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_EMULATE_PREPARES => false,
        ]
    );

    $devices = $pdo->query('SELECT DISTINCT device_id FROM readings ORDER BY device_id')
                   ->fetchAll(PDO::FETCH_COLUMN);

    if ($device === '' && $devices) {
        $device = $devices[0];
    }
    if ($device === '') {
        respond(200, ['device' => null, 'devices' => [], 'readings' => [], 'age' => null]);
    }

    if ($after_id > 0) {
        $stmt = $pdo->prepare(
            'SELECT id, sensor_type, value, created_at
               FROM readings
              WHERE device_id = ? AND id > ?
              ORDER BY id ASC
              LIMIT 500'
        );
        $stmt->bindValue(1, $device);
        $stmt->bindValue(2, $after_id, PDO::PARAM_INT);
    } else {
        $stmt = $pdo->prepare(
            'SELECT id, sensor_type, value, created_at FROM (
                 SELECT id, sensor_type, value, created_at
                   FROM readings
                  WHERE device_id = ?
                  ORDER BY id DESC
                  LIMIT ?
             ) AS newest
             ORDER BY id ASC'
        );
        $stmt->bindValue(1, $device);
        $stmt->bindValue(2, $limit, PDO::PARAM_INT);
    }
    $stmt->execute();

    $readings = [];
    foreach ($stmt as $row) {
        $readings[] = [
            'id'          => (int)$row['id'],
            'sensor_type' => $row['sensor_type'],
            'value'       => (float)$row['value'],
            'created_at'  => $row['created_at'],
        ];
    }

    $ageStmt = $pdo->prepare(
        'SELECT TIMESTAMPDIFF(SECOND, MAX(created_at), NOW()) FROM readings WHERE device_id = ?'
    );
    $ageStmt->execute([$device]);
    $age = $ageStmt->fetchColumn();

    respond(200, [
        'device'   => $device,
        'devices'  => $devices,
        'readings' => $readings,
        'age'      => $age === null ? null : (int)$age,
    ]);
} catch (PDOException $e) {
    error_log('readings.php DB error: ' . $e->getMessage());
    respond(500, ['error' => 'Database error']);
}
