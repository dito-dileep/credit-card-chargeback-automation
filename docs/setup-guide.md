# Setup guide

Install Java 21, Maven 3.9+, Node 20+ and Docker Desktop. Copy `.env.example` to `.env`; do not commit it. Start the application stack using the root README command. The backend pins Camunda Spring Boot 3 starter 8.8.15 with Spring Boot 3.5.0; confirm the version matrix before upgrading. For local Camunda, download and extract the official Camunda 8 Docker Compose distribution, start it from its own directory, then deploy this project's BPMN/DMN files. Camunda credentials are only required for a managed cluster.
