// rollup.config.ts
import commonjs from '@rollup/plugin-commonjs'
import nodeResolve from '@rollup/plugin-node-resolve'
import typescript from '@rollup/plugin-typescript'

const config = {
  input: 'src/index.ts',
  output: {
    esModule: true,
    file: 'dist/index.js',
    format: 'es',
    sourcemap: true
  },
  external: [
    '@actions/core',
    '@actions/github',
    '@actions/exec',
    '@actions/io',
    '@actions/http-client',
    '@octokit/graphql'
  ],
  plugins: [typescript(), nodeResolve({ preferBuiltins: true }), commonjs()]
}

export default config
