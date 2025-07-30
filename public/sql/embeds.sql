CREATE TABLE IF NOT EXISTS embeds (
    title VARCHAR(256) NOT NULL,
    description VARCHAR(4096),
    url VARCHAR(512),
    color INTEGER,
    footer JSON,
    image_url VARCHAR(512),
    thumbnail_url VARCHAR(512),
    author JSON,
    fields JSON
);