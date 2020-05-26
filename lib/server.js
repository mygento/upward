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

const { traverse } = require('./traverse');
const { connectToQueue } = require('./rabbit');
const { canCache, getClient, getKey, hasKey, setKey, appendCacheTags } = require('./cache');

const fetchServer = (client, query, variables, auth = false) => client.query({
    query: query,
    variables: variables,
    context: auth ? { headers: { authorization: auth } } : {},
});

async function startServer() {
    const purgeCache = (message) => {
      debug(message);
    }
    connectToQueue(purgeCache);
    const cacheStorage = getClient();
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

        if (await hasKey(cacheStorage, hash)) {
            const cache = { data: await getKey(cacheStorage, hash) };
            debug('cache result', cache);
            ctx.body = cache;
            ctx.set({
                'X-Cache': 'HIT'
            });
            return;
        }

        const result = await fetchServer(client, query, variables);
        setKey(cacheStorage, hash, result.data);

        const tags = [...traverse(result.data)];
        debug('tags', hash, tags);
        tags.forEach((item) => {
            appendCacheTags(cacheStorage, item, hash);
        });

        debug('query result', JSON.stringify(result));
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
