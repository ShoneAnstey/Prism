const baseConfig = require("./eslint.config.cjs");

module.exports = baseConfig.map((config) => {
    if (config && Array.isArray(config.files) && config.files.includes("**/*.js")) {
        return {
            ...config,
            rules: {
                ...(config.rules ?? {}),
                "no-unsanitized/method": "warn",
                "no-unsanitized/property": "warn"
            }
        };
    }

    return config;
});
