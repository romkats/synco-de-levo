# Build stage
FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

COPY ["SyncoDeLevo.Api.csproj", "."]
RUN dotnet restore "SyncoDeLevo.Api.csproj"

COPY . .
RUN dotnet build "SyncoDeLevo.Api.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "SyncoDeLevo.Api.csproj" -c Release -o /app/publish

# Runtime stage
FROM mcr.microsoft.com/dotnet/aspnet:8.0
WORKDIR /app
COPY --from=publish /app/publish .

EXPOSE 8080
ENV ASPNETCORE_URLS=http://+:8080
ENV ASPNETCORE_ENVIRONMENT=Production

ENTRYPOINT ["dotnet", "SyncoDeLevo.Api.dll"]
