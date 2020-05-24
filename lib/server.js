const Koa = require('koa');
const Router = require('@koa/router');
const json = require('koa-json');
const bodyParser = require('koa-bodyparser');
const responseTime = require('koa-response-time');
const logger = require('koa-logger');
const fetch = require('node-fetch');
const { ApolloClient, HttpLink, InMemoryCache, gql } = require('@apollo/client');
const { defaultGenerateHash } = require('apollo-link-persisted-queries');
const hashObject = require('object-hash');
const debug = require('debug')('upward:server');
const LRU = require('lru-cache');

const { connectToQueue } = require('./rabbit');

const CACHE_BAN = ['cart', 'wishlist', 'customer', 'customerOrders', 'currency'];
const CACHE_OPTIONS = { maxAge: 1000 * 60 * 60 * 6 };

const canCache = (query, ctx, auth = false) => {
    if (auth !== false) {
      return false;
    }
    const mutations = query.definitions.filter((d) => d.operation === 'mutation');
    if (mutations.length > 0) {
        return false;
    }

    const operation = ctx.request.body.operationName;
    if (CACHE_BAN.includes(operation)) {
        return false;
    }

    return true;
};

const setCacheTags = (hashId, queryResult) => {

};

const fetchServer = (client, query, variables, auth = false) => client.query({
    query: query,
    variables: variables,
    context: auth ? { headers: { authorization: auth } } : {},
});

//const hasCache = (hashId, cacheStorage) => cacheStorage.hasOwnProperty(hashId);

async function startServer() {
    const purgeCache = (message) => {
      debug(message);
    }
    connectToQueue(purgeCache);
    const cacheStorage = new LRU(CACHE_OPTIONS);
    const cacheTags = {};
    const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
            uri: `${process.env.MAGE_HOST}/graphql`,
            fetch
        }),
        defaultOptions: {
            query: {
                fetchPolicy: 'no-cache',
                errorPolicy: 'all'
            }
        }
    });

    const app = new Koa();
    app.use(json());
    app.use(bodyParser());
    app.use(responseTime());
    app.use(logger());

    const router = new Router();

    router.get('/cache',  async (ctx, _next) => {
        ctx.body = cacheStorage.dump();
    });

    router.post('/graphql',  async (ctx, _next) => {
        const graph = ctx.request.body.query;
        const query = gql`${graph}`;
        const variables = ctx.request.body.variables || {};
        const headers = ctx.request.headers;
        const auth  = headers.authorization ? headers.authorization : false;

        if (!canCache(query, ctx, auth)) {
            const uncacheable = await fetchServer(client, query, variables, auth);
            debug('no cache', uncacheable);
            ctx.body = uncacheable;
            ctx.set({
                'X-Cache': 'SKIP'
            });
            return;
        }

        const hash = `${defaultGenerateHash(query)}_${hashObject(variables)}`;

        if (cacheStorage.has(hash)) {
            const cache = { data: cacheStorage.get(hash) };
            debug('cache result', cache);
            ctx.body = cache;
            ctx.set({
                'X-Cache': 'HIT'
            });
            return;
        }

        const result = await fetchServer(client, query, variables);
        cacheStorage.set(hash, result.data);

        // TODO: tags
        // newCacheTags = setCacheTags(hash, result.data);

        debug('query result', result);
        ctx.body = result;
        ctx.set({
            'X-Cache': 'MISS'
        });
    });
    app.use(router.routes());
    app.use(router.allowedMethods());
    return app.listen(4000);
}

module.exports = { app: startServer };
