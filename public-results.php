<?php
declare(strict_types=1);

$config = require __DIR__ . '/config.php';
$appEnv = (string) ($config['app_env'] ?? 'production');

// Security headers for the HTML page.
header('X-Content-Type-Options: nosniff');
header('X-Frame-Options: SAMEORIGIN');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'");
?>
<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Community Wall – Personality Test</title>
  <meta name="description" content="Blader door gedeelde persoonlijkheidsresultaten van de community.">
  <link rel="icon" type="image/svg+xml" href="favicon.svg">
  <link rel="stylesheet" href="assets/style.css">
</head>
<body class="theme-dark">
  <button type="button" class="theme-toggle" id="theme-toggle" aria-label="Schakel tussen licht en donker thema" title="Wissel licht/donker">
    ☀️ Licht
  </button>
  <main class="container public-results-container" data-app-env="<?php echo htmlspecialchars($appEnv, ENT_QUOTES, 'UTF-8'); ?>">
    <header class="public-results-header">
      <p class="public-results-kicker">Community</p>
      <h1>Gedeelde resultaten</h1>
      <p>Ontdek publieke persoonlijkheidsprofielen van andere deelnemers.</p>
      <a class="public-results-back" href="index.php">← Terug naar de test</a>
    </header>

    <section aria-live="polite" aria-busy="true" id="public-results-status" class="public-results-state">Laden…</section>
    <section id="public-results-list" class="public-results-grid" aria-label="Publieke resultaten"></section>
  </main>

  <script type="module" src="assets/js/public-results-view.js"></script>
</body>
</html>
