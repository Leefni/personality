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

    if (!isset($pdo) && $isDevelopment && $isAuthError) {
        http_response_code(500);

        $message = sprintf(
            'Database authentication failed. Check DB_USER/DB_PASS for %s:%d and update env vars or config.local.php.',
            $config['db_host'],
            $config['db_port']
        );

        if (PHP_SAPI !== 'cli') {
            header('Content-Type: text/plain; charset=utf-8');
        }

        exit($message);
    }

    if (!isset($pdo)) {
        throw $exception;
    }
}

require_once __DIR__ . '/db_bootstrap.php';
bootstrap_database($pdo, $config);
