<?php
declare(strict_types=1);

/**
 * @deprecated File-backed result cache is disabled and will be removed after 2026-12-31.
 * Use DB cache helpers in api/v1/cache.php instead.
 */
const ENABLE_FILE_RESULTS_CACHE = false;

const RESULTS_CACHE_FILE = __DIR__ . '/../../cache/results.json';

function read_results_cache(): array
{
    if (!ENABLE_FILE_RESULTS_CACHE) {
        return [];
    }

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
    if (!ENABLE_FILE_RESULTS_CACHE) {
        return;
    }

    $cacheDir = dirname(RESULTS_CACHE_FILE);
    if (!is_dir($cacheDir)) {
        mkdir($cacheDir, 0777, true);
    }

    file_put_contents(RESULTS_CACHE_FILE, json_encode($cache, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE));
}

function clear_visitor_cache(string $visitor): void
{
    if (!ENABLE_FILE_RESULTS_CACHE) {
        return;
    }

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
