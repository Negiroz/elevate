module.exports = {
    apps: [
        {
            name: 'app-server',
            script: 'server/index.js',
            env: {
                NODE_ENV: 'production',
                PORT: 3000
            }
        },
        {
            name: 'app-client',
            script: 'npm',
            args: 'run dev',
            env: {
                NODE_ENV: 'development'
            }
        }
    ]
};
