<!DOCTYPE html>
<html lang="nl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Personality Test</title>
  <link rel="stylesheet" href="assets/style.css">
</head>
<body>
  <main class="container">
    <h1>Personality Test</h1>
    <p class="progress" id="progress">Laden...</p>

    <section id="questions"></section>
    <nav class="nav" id="nav"></nav>
    <section class="result" id="result"></section>
  </main>

  <?php $appEnv = getenv('APP_ENV') ?: 'production'; ?>
  <script>
    window.APP_ENV = <?php echo json_encode($appEnv, JSON_HEX_TAG | JSON_HEX_AMP | JSON_HEX_APOS | JSON_HEX_QUOT); ?>;
  </script>
  <script src="assets/app.js"></script>
</body>
</html>
