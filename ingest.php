<?php 
header('Content-Type: application/json')
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
?>
