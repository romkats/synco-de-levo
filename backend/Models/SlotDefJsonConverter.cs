using System.Text.Json;
using System.Text.Json.Serialization;

namespace SyncoDeLevo.Api.Models;

/// <summary>
/// Accepts both legacy string entries (just the slot name) and the new object
/// form { "name": "...", "default": { ... } | null } when reading.
/// Always writes the object form.
/// </summary>
public class SlotDefJsonConverter : JsonConverter<SlotDef>
{
    public override SlotDef Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.String)
        {
            var name = reader.GetString() ?? string.Empty;
            return new SlotDef(name);
        }
        if (reader.TokenType == JsonTokenType.StartObject)
        {
            string? name = null;
            SlotValue? defaultValue = null;
            while (reader.Read())
            {
                if (reader.TokenType == JsonTokenType.EndObject) break;
                if (reader.TokenType != JsonTokenType.PropertyName) continue;
                var prop = reader.GetString();
                reader.Read();
                if (string.Equals(prop, "name", StringComparison.OrdinalIgnoreCase))
                {
                    name = reader.TokenType == JsonTokenType.Null ? null : reader.GetString();
                }
                else if (string.Equals(prop, "default", StringComparison.OrdinalIgnoreCase))
                {
                    defaultValue = reader.TokenType == JsonTokenType.Null
                        ? null
                        : JsonSerializer.Deserialize<SlotValue>(ref reader, options);
                }
                else
                {
                    reader.Skip();
                }
            }
            return new SlotDef(name ?? string.Empty, defaultValue);
        }
        throw new JsonException($"Unexpected token {reader.TokenType} when reading SlotDef");
    }

    public override void Write(Utf8JsonWriter writer, SlotDef value, JsonSerializerOptions options)
    {
        writer.WriteStartObject();
        writer.WriteString("name", value.Name);
        if (value.Default is not null)
        {
            writer.WritePropertyName("default");
            JsonSerializer.Serialize(writer, value.Default, options);
        }
        writer.WriteEndObject();
    }
}
