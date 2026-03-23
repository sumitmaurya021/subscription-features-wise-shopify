import { createYoga, createSchema } from "graphql-yoga";
import {
  typeDefs as reviewTypeDefs,
  resolvers as reviewResolvers,
} from "../graphql/reviewSchema.server";
import {
  typeDefs as wishlistTypeDefs,
  resolvers as wishlistResolvers,
} from "../graphql/wishlistSchema.server";
import {
  typeDefs as loyaltyTypeDefs,
  resolvers as loyaltyResolvers,
} from "../graphql/loyaltySchema.server";

const rootTypeDefs = /* GraphQL */ `
  type Query
  type Mutation
`;

const yoga = createYoga({
  schema: createSchema({
    typeDefs: [rootTypeDefs, reviewTypeDefs, wishlistTypeDefs, loyaltyTypeDefs],
    resolvers: {
      Query: {
        ...(reviewResolvers.Query || {}),
        ...(wishlistResolvers.Query || {}),
        ...(loyaltyResolvers.Query || {}),
      },
      Mutation: {
        ...(reviewResolvers.Mutation || {}),
        ...(wishlistResolvers.Mutation || {}),
        ...(loyaltyResolvers.Mutation || {}),
      },
    },
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