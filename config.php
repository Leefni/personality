<?php
declare(strict_types=1);

function env_or_default(string $key, mixed $default): mixed
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function env_bool_or_default(string $key, bool $default): bool
{
    $value = getenv($key);

    if ($value === false) {
        return $default;
    }

    $parsed = filter_var($value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
    return $parsed ?? $default;
}

$baseConfig = [
    // USBWebserver defaults: MySQL host 127.0.0.1, user root, empty password.
    'db_host' => (string) env_or_default('DB_HOST', '127.0.0.1'),
    'db_port' => (int) env_or_default('DB_PORT', 3306),
    'db_name' => (string) env_or_default('DB_NAME', 'personality'),
    'db_user' => (string) env_or_default('DB_USER', 'root'),
    'db_pass' => (string) env_or_default('DB_PASS', ''),
    'db_auto_bootstrap' => env_bool_or_default('DB_AUTO_BOOTSTRAP', true),
    'app_env' => (string) env_or_default('APP_ENV', 'production'),
];

// Optional local, non-env override for setups where editing a local file is easier.
$localConfigPath = __DIR__ . '/config.local.php';
if (is_file($localConfigPath)) {
    $localConfig = require $localConfigPath;

    if (is_array($localConfig)) {
        $baseConfig = array_replace($baseConfig, $localConfig);
    }
}

return $baseConfig;
