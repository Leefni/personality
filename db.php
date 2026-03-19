<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';

$dsn = sprintf(
    'mysql:host=%s;port=%d;dbname=%s;charset=utf8mb4',
    $config['db_host'],
    $config['db_port'],
    $config['db_name']
);

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

function is_api_request(): bool
{
    $requestUri = (string) ($_SERVER['REQUEST_URI'] ?? '');
    $scriptName = (string) ($_SERVER['SCRIPT_NAME'] ?? '');

    return str_contains($requestUri, '/api/') || str_contains($scriptName, '/api/');
}

function respond_database_bootstrap_error(
    PDOException $exception,
    array $config,
    bool $isDevelopment,
    bool $isAuthError
): void {
    if ($isDevelopment && $isAuthError) {
        $message = sprintf(
            'Database authentication failed. Check DB_USER/DB_PASS for %s:%d and update env vars or config.local.php.',
            $config['db_host'],
            $config['db_port']
        );
    } else {
        $message = 'Database connection failed. Verify database host/port credentials and that MySQL is running.';
    }

    if (!is_api_request()) {
        throw $exception;
    }

    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }

    $payload = ['error' => true, 'message' => $message];
    if ($isDevelopment) {
        $payload['code'] = (string) ($exception->errorInfo[0] ?? $exception->getCode());
        $payload['detail'] = $exception->getMessage();
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function respond_database_runtime_error(Throwable $exception, bool $isDevelopment): void
{
    if (!is_api_request()) {
        throw $exception;
    }

    http_response_code(500);
    if (!headers_sent()) {
        header('Content-Type: application/json; charset=utf-8');
    }

    $payload = [
        'error' => true,
        'message' => 'Database initialisatie mislukt. Controleer schema/migraties en database-rechten.'
    ];

    if ($isDevelopment) {
        $payload['detail'] = $exception->getMessage();
        $payload['exception'] = get_class($exception);
    }

    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function quote_mysql_identifier(string $identifier): string
{
    return '`' . str_replace('`', '``', $identifier) . '`';
}

$environment = strtolower((string) ($config['app_env'] ?? 'production'));
$isDevelopment = in_array($environment, ['dev', 'development', 'local'], true);

try {
    $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], $options);
} catch (PDOException $exception) {
    $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode());
    $driverErrorCode = (int) ($exception->errorInfo[1] ?? 0);
    $isUnknownDatabaseError = $sqlState === 'HY000' && $driverErrorCode === 1049;
    $isAuthError = $sqlState === '28000' || $driverErrorCode === 1045;

    if ($isUnknownDatabaseError) {
        try {
            $fallbackDsn = sprintf(
                'mysql:host=%s;port=%d;charset=utf8mb4',
                $config['db_host'],
                $config['db_port']
            );

            $fallbackPdo = new PDO($fallbackDsn, $config['db_user'], $config['db_pass'], $options);
            $createDatabaseSql = sprintf(
                'CREATE DATABASE IF NOT EXISTS %s CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci',
                quote_mysql_identifier((string) $config['db_name'])
            );
            $fallbackPdo->exec($createDatabaseSql);

            $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], $options);
        } catch (PDOException $fallbackException) {
            $exception = $fallbackException;
            $sqlState = (string) ($exception->errorInfo[0] ?? $exception->getCode());
            $driverErrorCode = (int) ($exception->errorInfo[1] ?? 0);
            $isAuthError = $sqlState === '28000' || $driverErrorCode === 1045;
        }
    }

    if (!isset($pdo)) {
        respond_database_bootstrap_error($exception, $config, $isDevelopment, $isAuthError);
    }
}

require_once __DIR__ . '/db_bootstrap.php';

try {
    bootstrap_database($pdo, $config);
} catch (Throwable $exception) {
    respond_database_runtime_error($exception, $isDevelopment);
}
