using System.Text.Json.Serialization;
using SyncoDeLevo.Api.Hubs;
using SyncoDeLevo.Api.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services
    .AddControllers()
    .AddJsonOptions(opts =>
    {
        opts.JsonSerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
        opts.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        opts.JsonSerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
    });

builder.Services.AddSignalR();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddSingleton<IIdGenerator, IdGenerator>();
builder.Services.AddSingleton<IScenarioStore, ScenarioStore>();
builder.Services.AddSingleton<ITemplateService, TemplateService>();
builder.Services.AddHostedService<ScenarioCleanupService>();

const string CorsPolicy = "frontend";
var allowedOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>() 
    ?? new[] { "http://localhost:5173", "http://127.0.0.1:5173" };

builder.Services.AddCors(o => o.AddPolicy(CorsPolicy, p =>
    p.WithOrigins(allowedOrigins)
     .AllowAnyHeader()
     .AllowAnyMethod()
     .AllowCredentials()));

var app = builder.Build();

app.UseCors(CorsPolicy);
app.MapControllers();
app.MapHub<LevelHub>("/hubs/level");

app.Run();
