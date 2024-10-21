# FROM mcr.microsoft.com/playwright:v1.38.0-focal

# COPY . /e2e-playwright

# WORKDIR /e2e-playwright

# RUN npm install

# CMD [ "npx", "playwright", "test", "--reporter=list" ]

FROM mcr.microsoft.com/playwright:v1.47.2-focal

# Install Node.js (specify version as needed)
RUN npm install

# Set the working directory
WORKDIR /e2e-playwright

# Copy package files and install dependencies
COPY package*.json ./
RUN npm install

# Install Playwright browsers
RUN npx playwright install

# Copy the rest of your project files
COPY . .

# Default command to run tests
CMD ["npx", "playwright", "test"]
