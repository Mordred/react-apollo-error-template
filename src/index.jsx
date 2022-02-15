/*** SCHEMA ***/
import {
  GraphQLSchema,
  GraphQLObjectType,
  GraphQLInt,
} from "graphql";

let tick = 0;
setInterval(() => {
  tick++;
}, 1000);

function delay(wait) {
  return new Promise((resolve) => setTimeout(resolve, wait));
}

const QueryType = new GraphQLObjectType({
  name: "Query",
  fields: {
    tick: {
      type: GraphQLInt,
      resolve: () => tick,
    },
  },
});

const SubscriptionType = new GraphQLObjectType({
  name: "Subscription",
  fields: {
    ticked: {
      type: GraphQLInt,
      resolve: () => tick,
    },
  },
});

const schema = new GraphQLSchema({
  query: QueryType,
  subscription: SubscriptionType,
});

/*** LINK ***/
import { graphql, print } from "graphql";
import { ApolloLink, Observable } from "@apollo/client";
import { getMainDefinition } from "@apollo/client/utilities";
const link = new ApolloLink((operation) => {
  return new Observable((observer) => {
    let timer;
    const execute = async () => {
    const { query, operationName, variables } = operation;
    await delay(300);

    const definition = getMainDefinition(query);
    try {
      if (
        definition.kind === "OperationDefinition" &&
        definition.operation === "subscription"
      ) {
        observer.next(
          await graphql({
            schema,
            source: print(query),
            variableValues: variables,
            operationName,
          })
        );
        timer = setInterval(async () => {
          console.log('tick from server');
          observer.next(
            await graphql({
              schema,
              source: print(query),
              variableValues: variables,
              operationName,
            })
          );
        }, 1000);
      } else {
        const result = await graphql({
          schema,
          source: print(query),
          variableValues: variables,
          operationName,
        });
        observer.next(result);
        observer.complete();
      }
    } catch (err) {
      observer.error(err);
    }
  }

  execute();

  return () => {
    clearInterval(timer);
  }

  });
});

/*** APP ***/
import React, { useEffect, useState } from "react";
import { render } from "react-dom";
import {
  ApolloClient,
  ApolloProvider,
  InMemoryCache,
  gql,
  useQuery,
} from "@apollo/client";
import "./index.css";

function App() {
  const [showTick, setShowTick] = useState(true);

  return (
    <main>
      <h1>Apollo Client Issue Reproduction</h1>
      <p>
        This application can be used to demonstrate an error in Apollo Client.
      </p>

      <button
        onClick={() => {
          setShowTick((s) => !s);
        }}
      >
        {showTick ? "Hide" : "Show"}
      </button>

      {showTick && <Tick />}
    </main>
  );
}

const TICK_QUERY = gql`
  query Tick {
    tick
  }
`;

const TICK_SUBSCRIPTION = gql`
  subscription Ticked {
    ticked
  }
`;

function Tick() {
  const { data, subscribeToMore } = useQuery(TICK_QUERY);

  useEffect(() => {
    return subscribeToMore({
      document: TICK_SUBSCRIPTION,
      updateQuery: (prev, { subscriptionData }) => {
        return {
          ...prev,
          tick: subscriptionData.data.ticked,
        };
      },
    });
  }, []);

  return <div style={{ marginTop: '1em', fontSize: '3rem', color: "green" }}>{data?.tick}</div>;
}

const SSR_CACHE_DATA = {
  "ROOT_QUERY": {
    "__typename": "Query",
    "tick": 0
  },
}

const cache = new InMemoryCache();
cache.restore(SSR_CACHE_DATA);

const client = new ApolloClient({
  cache,
  link,
  ssrForceFetchDelay: 100,
});

render(
  <ApolloProvider client={client}>
    <App />
  </ApolloProvider>,
  document.getElementById("root")
);
