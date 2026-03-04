<?php
declare(strict_types=1);

/**
 * Example integration-style tests for API v1 endpoints.
 *
 * Run with:
 *   BASE_URL="http://localhost/personality" php tests/api_v1_endpoints_test.php
 */

$baseUrl = rtrim((string) getenv('BASE_URL'), '/');
if ($baseUrl === '') {
    fwrite(STDERR, "Set BASE_URL first, e.g. BASE_URL=http://localhost/personality\n");
    exit(1);
}

$visitor = 'testvisitor1234567890abcdef12345678';

function request_json(string $method, string $url, ?array $payload = null, ?string $visitor = null): array
{
    $headers = ['Content-Type: application/json'];
    if ($visitor !== null) {
        $headers[] = 'X-Visitor-Id: ' . $visitor;
    }

    $context = stream_context_create([
        'http' => [
            'method' => $method,
            'header' => implode("\r\n", $headers),
            'content' => $payload ? json_encode($payload) : '',
            'ignore_errors' => true,
        ],
    ]);

    $body = file_get_contents($url, false, $context);
    $statusLine = $http_response_header[0] ?? 'HTTP/1.1 500 Internal Server Error';
    preg_match('/\s(\d{3})\s/', $statusLine, $matches);
    $status = (int) ($matches[1] ?? 500);

    $decoded = json_decode((string) $body, true);
    return ['status' => $status, 'json' => $decoded];
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function test_get_questions(string $baseUrl): void
{
    $response = request_json('GET', $baseUrl . '/api/v1/get_questions.php?page=1&per_page=10');
    assert_true($response['status'] === 200, 'get_questions status');
    assert_true(isset($response['json']['questions']) && is_array($response['json']['questions']), 'get_questions questions array');
    assert_true(isset($response['json']['page']), 'get_questions page');
    assert_true(isset($response['json']['per_page']), 'get_questions per_page');
    assert_true(isset($response['json']['total']), 'get_questions total');
}

function test_get_progress(string $baseUrl, string $visitor): void
{
    $response = request_json('GET', $baseUrl . '/api/v1/get_progress.php', null, $visitor);
    assert_true($response['status'] === 200, 'get_progress status');
    assert_true(is_array($response['json']), 'get_progress array');
}

function test_save_answer(string $baseUrl, string $visitor): void
{
    $response = request_json('POST', $baseUrl . '/api/v1/save_answer.php', [
        'question_id' => 1,
        'value' => 3,
    ], $visitor);

    assert_true($response['status'] === 200, 'save_answer status');
    assert_true(($response['json']['ok'] ?? false) === true, 'save_answer ok');
}

function test_submit_results_incomplete(string $baseUrl, string $visitor): void
{
    $response = request_json('POST', $baseUrl . '/api/v1/submit_results.php', [], $visitor);
    assert_true(in_array($response['status'], [200, 422], true), 'submit_results status should be 200 or 422');

    if ($response['status'] === 422) {
        assert_true(($response['json']['error'] ?? false) === true, 'submit_results error shape');
        assert_true(isset($response['json']['message']), 'submit_results message');
    } else {
        assert_true(isset($response['json']['type']), 'submit_results type');
        assert_true(isset($response['json']['scores']) && is_array($response['json']['scores']), 'submit_results scores');
    }
}

function test_reset_progress(string $baseUrl, string $visitor): void
{
    $response = request_json('POST', $baseUrl . '/api/v1/reset_progress.php', [], $visitor);
    assert_true($response['status'] === 200, 'reset_progress status');
    assert_true(($response['json']['ok'] ?? false) === true, 'reset_progress ok');
}

try {
    test_get_questions($baseUrl);
    test_get_progress($baseUrl, $visitor);
    test_save_answer($baseUrl, $visitor);
    test_submit_results_incomplete($baseUrl, $visitor);
    test_reset_progress($baseUrl, $visitor);

    echo "All example API tests passed.\n";
} catch (Throwable $error) {
    fwrite(STDERR, 'Test failed: ' . $error->getMessage() . "\n");
    exit(1);
}
