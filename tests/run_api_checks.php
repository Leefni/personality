<?php
declare(strict_types=1);

$rootDir = dirname(__DIR__);
$frontendCheck = $rootDir . '/tests/frontend_syntax_check.mjs';
$apiTest = $rootDir . '/tests/api_v1_endpoints_test.php';

$nodeCommand = sprintf('node %s', escapeshellarg($frontendCheck));
$frontendStatus = 0;
passthru($nodeCommand, $frontendStatus);
if ($frontendStatus !== 0) {
    exit($frontendStatus);
}

$args = array_slice($argv, 1);
$escapedArgs = array_map(static fn(string $arg): string => escapeshellarg($arg), $args);
$apiCommand = 'php ' . escapeshellarg($apiTest);
if ($escapedArgs !== []) {
    $apiCommand .= ' ' . implode(' ', $escapedArgs);
}

$apiStatus = 0;
passthru($apiCommand, $apiStatus);
exit($apiStatus);
