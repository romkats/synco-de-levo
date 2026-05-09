using System.Security.Cryptography;

namespace SyncoDeLevo.Api.Services;

public interface IIdGenerator
{
    string NewScenarioId();
}

public class IdGenerator : IIdGenerator
{
    private const string Alphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
    private const int Length = 8;

    public string NewScenarioId()
    {
        var chars = new char[Length];
        Span<byte> buffer = stackalloc byte[Length];
        RandomNumberGenerator.Fill(buffer);
        for (var i = 0; i < Length; i++)
        {
            chars[i] = Alphabet[buffer[i] % Alphabet.Length];
        }
        return new string(chars);
    }
}
