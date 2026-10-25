using System.Reflection;
using System.Text.Json.Serialization;

namespace Jellyfin.Plugin.TbdWatchHistory;

public class PatchRequestPayload
{
    [JsonPropertyName("contents")]
    public string? Contents { get; set; }
}

public static class Transformer
{
    private const string Marker = "id=\"tbd-watch-history\"";

    private static readonly Lazy<string> Script = new(LoadScript);

    /// <summary>Called by File Transformation for index.html.</summary>
    public static string Inject(PatchRequestPayload payload)
    {
        string html = payload.Contents ?? string.Empty;

        if (html.Contains(Marker, StringComparison.Ordinal))
        {
            return html;
        }

        string flag = "<script>window.__tbdwhPage=" + (Plugin.PageRegistered ? "true" : "false") + ";</script>";
        string block = flag + "<script " + Marker + ">" + Script.Value + "</script>";
        int index = html.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);

        if (index < 0)
        {
            // Not the real index.html (File Transformation can match other files too). Leave it untouched.
            return html;
        }

        return html.Insert(index, block);
    }

    private static string LoadScript()
    {
        Assembly assembly = typeof(Transformer).Assembly;
        string name = assembly.GetManifestResourceNames().First(n => n.EndsWith("watchhistory.js", StringComparison.Ordinal));

        using Stream stream = assembly.GetManifestResourceStream(name)!;
        using StreamReader reader = new(stream);
        return reader.ReadToEnd();
    }
}
