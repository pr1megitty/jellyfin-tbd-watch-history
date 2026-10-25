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

    /// <summary>
    /// Called by File Transformation for files whose name matches "index.html".
    /// The pattern is a regex, so it can also match other files (and virtual files made by other plugins,
    /// such as Plugin Pages' own chunks). Anything that is not a real HTML page is returned exactly as received.
    /// </summary>
    public static string Inject(PatchRequestPayload payload)
    {
        string? original = payload.Contents;

        if (string.IsNullOrEmpty(original)
            || original.Contains(Marker, StringComparison.Ordinal))
        {
            return original!; // untouched (may be null for virtual files)
        }

        int index = original.LastIndexOf("</body>", StringComparison.OrdinalIgnoreCase);
        if (index < 0)
        {
            return original;
        }

        string flag = "<script>window.__tbdwhPage=" + (Plugin.PageRegistered ? "true" : "false") + ";</script>";
        string block = flag + "<script " + Marker + ">" + Script.Value + "</script>";

        return original.Insert(index, block);
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
