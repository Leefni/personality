<?php
declare(strict_types=1);

function env_or_default(string $key, $default)
{
    $value = getenv($key);
    return $value === false ? $default : $value;
}

function env_non_empty_or_default(string $key, $default)
{
    $value = getenv($key);

    if ($value === false) {
        return $default;
    }

    if (is_string($value) && trim($value) === '') {
        return $default;
    }

    return $value;
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
    'db_host' => (string) env_non_empty_or_default('DB_HOST', '127.0.0.1'),
    'db_port' => (int) env_non_empty_or_default('DB_PORT', 3306),
    'db_name' => (string) env_non_empty_or_default('DB_NAME', 'personality'),
    'db_user' => (string) env_non_empty_or_default('DB_USER', 'root'),
    'db_pass' => (string) env_or_default('DB_PASS', ''),
    'db_auto_bootstrap' => env_bool_or_default('DB_AUTO_BOOTSTRAP', true),
    'app_env' => (string) env_non_empty_or_default('APP_ENV', 'production'),
    'test_version' => (string) env_non_empty_or_default('TEST_VERSION', '2026.03'),
    'test_release_date' => (string) env_non_empty_or_default('TEST_RELEASE_DATE', '2026-03-18'),
    'recovery_token_ttl_seconds' => (int) env_non_empty_or_default('RECOVERY_TOKEN_TTL_SECONDS', 900),
    'recovery_rate_limit_window_seconds' => (int) env_non_empty_or_default('RECOVERY_RATE_LIMIT_WINDOW_SECONDS', 3600),
    'recovery_rate_limit_max_per_visitor' => (int) env_non_empty_or_default('RECOVERY_RATE_LIMIT_MAX_PER_VISITOR', 3),
    'recovery_rate_limit_max_per_email' => (int) env_non_empty_or_default('RECOVERY_RATE_LIMIT_MAX_PER_EMAIL', 5),
    'recovery_email_from' => (string) env_non_empty_or_default('RECOVERY_EMAIL_FROM', 'no-reply@example.test'),
    'recovery_base_url' => (string) env_non_empty_or_default('RECOVERY_BASE_URL', ''),
    // Product/legal default: 90 days balances user continuity with data minimization.
    'retention_days' => (int) env_non_empty_or_default('RETENTION_DAYS', 90),
    'retention_max_delete_per_table' => (int) env_non_empty_or_default('RETENTION_MAX_DELETE_PER_TABLE', 5000),
    'retention_dry_run' => env_bool_or_default('RETENTION_DRY_RUN', false),
];

// Optional local, non-env override for setups where editing a local file is easier.
$localConfigPath = __DIR__ . '/config.local.php';
if (is_file($localConfigPath)) {
    $localConfig = require $localConfigPath;

    if (is_array($localConfig)) {
        $baseConfig = array_replace($baseConfig, $localConfig);
    }
}

$baseConfig['retention_days'] = max(1, (int) ($baseConfig['retention_days'] ?? 90));
$baseConfig['retention_max_delete_per_table'] = max(1, (int) ($baseConfig['retention_max_delete_per_table'] ?? 5000));
$baseConfig['retention_dry_run'] = (bool) ($baseConfig['retention_dry_run'] ?? false);
$baseConfig['privacy_retention_text'] = sprintf(
    'Je antwoorden worden tijdelijk opgeslagen zodat je later kunt doorgaan. Gegevens worden uiterlijk na %d dagen verwijderd of direct wanneer je op ‘Verwijder mijn gegevens’ klikt.',
    $baseConfig['retention_days']
);

return $baseConfig;
