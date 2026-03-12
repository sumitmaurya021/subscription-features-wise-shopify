import { createYoga, createSchema } from "graphql-yoga";
import { typeDefs, resolvers } from "../graphql/reviewSchema.server";

const yoga = createYoga({
  schema: createSchema({
    typeDefs,
    resolvers,
  }),
  graphqlEndpoint: "/graphql",
  graphiql: true,
  fetchAPI: { Response, Request, Headers },
});

export const loader = async ({ request }) => {
  return yoga.handleRequest(request);
};

export const action = async ({ request }) => {
  return yoga.handleRequest(request);
};
