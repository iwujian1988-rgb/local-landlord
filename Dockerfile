FROM node:18-alpine
WORKDIR /app
RUN apk add --no-cache ca-certificates && update-ca-certificates
RUN npm install -g pnpm
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/shared/package.json packages/shared/
COPY packages/server/package.json packages/server/
COPY packages/admin/package.json packages/admin/
RUN pnpm install --frozen-lockfile
COPY . .
RUN pnpm --filter local-landlord-admin build; mkdir -p packages/admin/dist
RUN pnpm --filter @local-landlord/server build
RUN cp -r packages/admin/dist packages/server/public 2>/dev/null || true
EXPOSE 80
ENV PORT=80
ENV NODE_ENV=production
CMD ["node", "packages/server/dist/main.js"]
