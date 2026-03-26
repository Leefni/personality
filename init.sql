CREATE TABLE IF NOT EXISTS questions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    text TEXT NOT NULL,
    dimension ENUM('EI','SN','TF','JP') NOT NULL,
    direction TINYINT NOT NULL DEFAULT 1,
    weight DECIMAL(4,2) NOT NULL DEFAULT 1.00
);

CREATE TABLE IF NOT EXISTS answers (
    id INT AUTO_INCREMENT PRIMARY KEY,
    question_id INT NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    value TINYINT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_answer (question_id, visitor_id),
    KEY idx_answers_visitor (visitor_id),
    CONSTRAINT fk_answers_question FOREIGN KEY (question_id) REFERENCES questions (id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS results (
    id INT AUTO_INCREMENT PRIMARY KEY,
    visitor_id VARCHAR(64) NOT NULL,
    type_code CHAR(4) NOT NULL,
    detail_json LONGTEXT NOT NULL,
    display_name VARCHAR(80) DEFAULT NULL,
    is_public TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_result_visitor (visitor_id),
    KEY idx_results_public_created (is_public, created_at)
);

CREATE TABLE IF NOT EXISTS public_results (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    public_id VARCHAR(32) NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    display_name VARCHAR(80) NOT NULL DEFAULT 'Anoniem',
    type_code CHAR(4) NOT NULL,
    scores_json LONGTEXT NOT NULL,
    is_visible TINYINT(1) NOT NULL DEFAULT 1,
    reported_count INT UNSIGNED NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_public_results_public_id (public_id),
    KEY idx_public_results_visible_created (is_visible, created_at),
    KEY idx_public_results_visitor_created (visitor_id, created_at)
);

CREATE TABLE IF NOT EXISTS recovery_tokens (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    token_hash CHAR(64) NOT NULL,
    visitor_id VARCHAR(64) NOT NULL,
    email VARCHAR(191) NOT NULL,
    expires_at DATETIME NOT NULL,
    redeemed_at DATETIME DEFAULT NULL,
    requested_ip VARCHAR(64) DEFAULT NULL,
    redeemed_ip VARCHAR(64) DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_recovery_token_hash (token_hash),
    KEY idx_recovery_visitor (visitor_id),
    KEY idx_recovery_email (email),
    KEY idx_recovery_expiry (expires_at)
);

CREATE TABLE IF NOT EXISTS recovery_audit_log (
    id BIGINT AUTO_INCREMENT PRIMARY KEY,
    event_type VARCHAR(64) NOT NULL,
    status VARCHAR(32) NOT NULL,
    visitor_id VARCHAR(64) DEFAULT NULL,
    email VARCHAR(191) DEFAULT NULL,
    ip_address VARCHAR(64) DEFAULT NULL,
    detail_json LONGTEXT DEFAULT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    KEY idx_recovery_audit_created (created_at),
    KEY idx_recovery_audit_event (event_type, created_at),
    KEY idx_recovery_audit_visitor (visitor_id, created_at),
    KEY idx_recovery_audit_email (email, created_at)
);
