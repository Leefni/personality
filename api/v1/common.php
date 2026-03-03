<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

require __DIR__ . '/../../db.php';

const RESULTS_CACHE_FILE = __DIR__ . '/../../cache/results.json';

function json_success(array $payload, int $status = 200): void
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

function json_error(string $message, int $status, array $extra = []): void
{
    http_response_code($status);
    echo json_encode(array_merge(['error' => true, 'message' => $message], $extra), JSON_UNESCAPED_UNICODE);
    exit;
}

function require_method(string $method): void
{
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        json_error('Method not allowed', 405);
    }
}

function get_json_payload(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    if (!is_array($decoded)) {
        json_error('Invalid JSON payload', 400);
    }

    return $decoded;
}

function get_visitor_id(?array $payload = null): string
{
    $cookieVisitor = (string) ($_COOKIE['visitor_id'] ?? '');
    if ($cookieVisitor !== '') {
        return $cookieVisitor;
    }

    if ($payload !== null && isset($payload['visitor_id']) && is_string($payload['visitor_id']) && $payload['visitor_id'] !== '') {
        return $payload['visitor_id'];
    }

    if (isset($_SERVER['HTTP_X_VISITOR_ID']) && $_SERVER['HTTP_X_VISITOR_ID'] !== '') {
        return (string) $_SERVER['HTTP_X_VISITOR_ID'];
    }

    return '';
}

function ensure_visitor_id(?array $payload = null): string
{
    $visitor = get_visitor_id($payload);
    if ($visitor !== '') {
        return $visitor;
    }

    $visitor = bin2hex(random_bytes(16));
    setcookie('visitor_id', $visitor, [
        'expires' => time() + 31536000,
        'path' => '/',
        'samesite' => 'Lax',
    ]);

    return $visitor;
}

function read_results_cache(): array
{
    if (!is_file(RESULTS_CACHE_FILE)) {
        return [];
    }

    $raw = file_get_contents(RESULTS_CACHE_FILE);
    if ($raw === false || $raw === '') {
        return [];
    }

    $decoded = json_decode($raw, true);
    return is_array($decoded) ? $decoded : [];
}

function write_results_cache(array $cache): void
{
    $cacheDir = dirname(RESULTS_CACHE_FILE);
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0777, true);
    }

    file_put_contents(RESULTS_CACHE_FILE, json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function clear_visitor_cache(string $visitor): void
{
    if ($visitor === '') {
        return;
    }

    $cache = read_results_cache();
    if (!array_key_exists($visitor, $cache)) {
        return;
    }

    unset($cache[$visitor]);
    write_results_cache($cache);
}
