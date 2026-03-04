<?php
declare(strict_types=1);

require __DIR__ . '/common.php';

$visitor = get_visitor_id();
if ($visitor === '') {
    json_success([]);
}

json_success($quizRepository->getVisitorAnswers($visitor));
