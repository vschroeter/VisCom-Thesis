FROM node:20-slim AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
# Install quasar CLI globally
RUN npm i -g @quasar/cli
COPY . /app
WORKDIR /app

FROM base AS prod-deps
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --prod --frozen-lockfile

FROM base AS build
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile
RUN pnpm run build

FROM base
WORKDIR /app
COPY --from=prod-deps /app/node_modules /app/node_modules
COPY --from=build /app/dist /app/dist

RUN pnpm install

EXPOSE 9000
CMD [ "pnpm", "dev" ]


# # Use the official Node.js image as the base image
# FROM node:20-alpine

# # Set the working directory
# WORKDIR /app

# # Copy package.json and lock file
# COPY package.json pnpm-lock.yaml ./

# # Install quasar CLI globally
# RUN npm i -g @quasar/cli

# # Install dependencies
# RUN npm install

# # Copy the rest of the application code
# COPY . .

# # Build the app for production
# RUN npm run build

# # Expose the port the app runs on (default Quasar port)
# EXPOSE 9000

# # Start the app
# CMD ["npm", "run", "dev"]
