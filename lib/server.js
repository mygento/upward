const Koa = require('koa');
const Router = require('@koa/router');
const json = require('koa-json');
const bodyParser = require('koa-bodyparser');
const responseTime = require('koa-response-time');
const logger = require('koa-logger')
const fetch = require('node-fetch');
const { ApolloClient, HttpLink, InMemoryCache, gql } =  require('@apollo/client');
const { defaultGenerateHash } = require('apollo-link-persisted-queries');

const canCache = (query, ctx) => {
    const mutations = query.definitions.filter((d) => d.operation === 'mutation');
    if (mutations.length > 0) {
        return false;
    }
    return true;
};

const setCacheTags = (hashId, queryResult) => {
    // const tags = [];
    // const variables = ctx.request.body.variables;
    // const operation = ctx.request.body.operationName;
    // if (operation === 'categoryList') {
    //     if (Object.keys(variables).count === 0) {
    //         tags.push('CAT');
    //     }
    //     if (variables.filters.ids.eq) {
    //         tags.push(`CAT${variables.filters.ids.eq}`);
    //     }
    // }
    //
    // if (operation === 'products') {
    //     if (variables.filter.sku.in) {
    //         tags.push(variables.filter.sku.in.map(p => `PR${p}`));
    //     }
    // }
};

const fetchServer = (client, query, variables) => client.query({
    query: query,
    variables: variables,
});

const hasCache = (hashId, cacheStorage) => cacheStorage.hasOwnProperty(hashId);

async function startServer() {
    const cacheStorage = {};
    const cacheTags = {};
    const client = new ApolloClient({
        cache: new InMemoryCache(),
        link: new HttpLink({
            uri: `${process.env.MAGE_HOST}/graphql`,
            fetch
        }),
        defaultOptions: {
            query: {
                fetchPolicy: 'no-cache'
            }
        }
    });

    const state = [];
    const app = new Koa();
    app.use(json());
    app.use(bodyParser());
    app.use(responseTime());
    app.use(logger());

    const router = new Router();
    router.post('/graphql',  async (ctx, next) => {
        state.push(1);
        const operation = ctx.request.body.operationName;
        const variables = ctx.request.body.variables;
        // console.log(operation);
        // console.log(variables);
        // console.log(ctx.request.body.query);
        const graph = ctx.request.body.query;
        const query = gql`${graph}`;

        if (!canCache(query, ctx)) {
            ctx.body = await fetchServer(client, query, variables);
            ctx.set({
                'X-Cache': 'MISS'
            });
            return;
        }
        const hash = defaultGenerateHash(query);
        if (hasCache(hash, cacheStorage)) {
            ctx.body = { ...cacheStorage[hash], localCache: cacheStorage };
            ctx.set({
                'X-Cache': 'HIT'
            });
            return;
        }
        const result = await fetchServer(client, query, variables);
        cacheStorage[hash] = result.data;
        // TODO: tags
        // newCacheTags = setCacheTags(hash, result.data);
        ctx.body = { ...result, localCache: cacheStorage };
        ctx.set({
            'X-Cache': 'MISS'
        });
    });
    app.use(router.routes());
    app.use(router.allowedMethods());
    return app.listen(4000);
}

module.exports = { app: startServer };
