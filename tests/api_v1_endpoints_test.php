<?php
declare(strict_types=1);

/**
 * Example integration-style tests for API v1 endpoints.
 *
 * Run with:
 *   BASE_URL="http://localhost/personality" php tests/api_v1_endpoints_test.php
 *   php tests/api_v1_endpoints_test.php http://localhost/personality
 */

function resolve_base_url(array $argv): string
{
    $baseUrlFromEnv = getenv('BASE_URL');
    if ($baseUrlFromEnv !== false && trim((string) $baseUrlFromEnv) !== '') {
        return rtrim((string) $baseUrlFromEnv, '/');
    }

    $argumentCount = count($argv);
    for ($i = 1; $i < $argumentCount; $i++) {
        $arg = (string) $argv[$i];

        if ($arg === '--base-url' && isset($argv[$i + 1])) {
            return rtrim((string) $argv[$i + 1], '/');
        }

        if (str_starts_with($arg, '--base-url=')) {
            return rtrim(substr($arg, strlen('--base-url=')), '/');
        }

        if ($arg !== '' && $arg[0] !== '-') {
            return rtrim($arg, '/');
        }
    }

    return '';
}

$baseUrl = resolve_base_url($argv ?? []);
if ($baseUrl === '') {
    $message = "Set BASE_URL first or pass it as an argument.\n"
        . "Examples:\n"
        . "  BASE_URL=http://localhost/personality php tests/api_v1_endpoints_test.php\n"
        . "  php tests/api_v1_endpoints_test.php http://localhost/personality\n"
        . "  php tests/api_v1_endpoints_test.php --base-url=http://localhost/personality\n";

    if (defined('STDERR')) {
        fwrite(STDERR, $message);
    } else {
        echo $message;
    }

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
    return [
        'status' => $status,
        'status_line' => $statusLine,
        'json' => $decoded,
        'body' => (string) $body,
        'url' => $url,
    ];
}

function assert_true(bool $condition, string $message): void
{
    if (!$condition) {
        throw new RuntimeException($message);
    }
}

function debug_response(array $response): string
{
    $json = json_encode($response['json'], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if ($json === false) {
        $json = 'null';
    }

    $bodyPreview = trim((string) ($response['body'] ?? ''));
    if ($bodyPreview === '') {
        $bodyPreview = '<empty body>';
    }

    if (strlen($bodyPreview) > 220) {
        $bodyPreview = substr($bodyPreview, 0, 220) . '...';
    }

    return sprintf(
        ' (url: %s, status: %s, json: %s, body: %s)',
        (string) ($response['url'] ?? '<unknown>'),
        (string) ($response['status_line'] ?? '<unknown>'),
        $json,
        $bodyPreview
    );
}

function test_get_questions(string $baseUrl): int
{
    $response = request_json('GET', $baseUrl . '/api/v1/get_questions.php?page=1&per_page=10');
    assert_true($response['status'] === 200, 'get_questions status' . debug_response($response));
    assert_true(isset($response['json']['questions']) && is_array($response['json']['questions']), 'get_questions questions array');
    assert_true(isset($response['json']['page']), 'get_questions page');
    assert_true(isset($response['json']['per_page']), 'get_questions per_page');
    assert_true(isset($response['json']['total']), 'get_questions total');

    $questions = $response['json']['questions'];
    assert_true(count($questions) > 0, 'get_questions should return at least one question for integration tests');
    $questionId = (int) ($questions[0]['id'] ?? 0);
    assert_true($questionId > 0, 'get_questions first question id should be a positive integer');

    return $questionId;
}

function test_get_progress(string $baseUrl, string $visitor): void
{
    $response = request_json('GET', $baseUrl . '/api/v1/get_progress.php', null, $visitor);
    assert_true($response['status'] === 200, 'get_progress status' . debug_response($response));
    assert_true(is_array($response['json']), 'get_progress array');
}

function test_save_answer(string $baseUrl, string $visitor, int $questionId): void
{
    $response = request_json('POST', $baseUrl . '/api/v1/save_answer.php', [
        'question_id' => $questionId,
        'value' => 3,
    ], $visitor);

    assert_true($response['status'] === 200, 'save_answer status' . debug_response($response));
    assert_true(($response['json']['ok'] ?? false) === true, 'save_answer ok');
}

function test_submit_results_incomplete(string $baseUrl, string $visitor): void
{
    $response = request_json('POST', $baseUrl . '/api/v1/submit_results.php', [], $visitor);
    assert_true(in_array($response['status'], [200, 422], true), 'submit_results status should be 200 or 422' . debug_response($response));

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
    assert_true($response['status'] === 200, 'reset_progress status' . debug_response($response));
    assert_true(($response['json']['ok'] ?? false) === true, 'reset_progress ok');
}

function test_legacy_wrapper_get_progress(string $baseUrl, string $visitor): void
{
    $legacy = request_json('GET', $baseUrl . '/api/get_progress.php', null, $visitor);
    $v1 = request_json('GET', $baseUrl . '/api/v1/get_progress.php', null, $visitor);

    assert_true($legacy['status'] === $v1['status'], 'legacy get_progress status matches v1');
    assert_true($legacy['json'] === $v1['json'], 'legacy get_progress payload matches v1');
}

try {
    $questionId = test_get_questions($baseUrl);
    test_get_progress($baseUrl, $visitor);
    test_save_answer($baseUrl, $visitor, $questionId);
    test_legacy_wrapper_get_progress($baseUrl, $visitor);
    test_submit_results_incomplete($baseUrl, $visitor);
    test_reset_progress($baseUrl, $visitor);

    echo "All example API tests passed.\n";
} catch (Throwable $error) {
    $message = 'Test failed: ' . $error->getMessage() . "\n";

    if (defined('STDERR')) {
        fwrite(STDERR, $message);
    } else {
        echo $message;
    }

    exit(1);
}
