<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$config = require __DIR__ . '/../config.php';

$pdoLoaded = extension_loaded('pdo');
$pdoMysqlLoaded = extension_loaded('pdo_mysql');
$dbConnectable = false;
$errorCode = null;

if (!$pdoLoaded || !$pdoMysqlLoaded) {
    $errorCode = 'DB_DRIVER_MISSING';
} else {
    $dsn = sprintf(
        'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
        (string) $config['db_host'],
        (int) $config['db_port'],
        (string) $config['db_name']
    );

    try {
        $pdo = new PDO(
            $dsn,
            (string) $config['db_user'],
            (string) $config['db_pass'],
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
                PDO::ATTR_TIMEOUT => 2,
            ]
        );

        $pdo->query('SELECT 1');
        $dbConnectable = true;
    } catch (Throwable $exception) {
        $errorCode = 'DB_CONNECT_FAILED';
    }
}

$response = [
    'status' => ($pdoLoaded && $pdoMysqlLoaded && $dbConnectable) ? 'ok' : 'error',
    'php_version' => PHP_VERSION,
    'pdo_loaded' => $pdoLoaded,
    'pdo_mysql_loaded' => $pdoMysqlLoaded,
    'db_connectable' => $dbConnectable,
];

if (array_key_exists('db_auto_bootstrap', $config)) {
    $response['bootstrap_enabled'] = (bool) $config['db_auto_bootstrap'];
}

if ($errorCode !== null) {
    $response['error_code'] = $errorCode;
}

echo json_encode($response, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
