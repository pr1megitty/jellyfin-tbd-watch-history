using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.TbdWatchHistory;

/// <summary>
/// TBD Watch History. Injects a self-contained history overlay into jellyfin-web through
/// File Transformation, and adds a "Watch History" entry to the user menu through Plugin Pages.
/// </summary>
public class Plugin : BasePlugin<BasePluginConfiguration>, IHasWebPages
{
    private const string PageName = "tbdwatchhistory.html";

    private static readonly Guid PluginGuid = Guid.Parse("7a0b5df1-bb7b-4a0b-add5-8afe03e880f0");
    private static readonly Guid TransformGuid = Guid.Parse("3c1f9d52-6e0a-4c43-9b7e-5d2a8f1e4b60");
    private static int _registering;

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;

        // The other plugins may load after this one, so retry until they show up.
        if (Interlocked.Exchange(ref _registering, 1) == 0)
        {
            _ = Task.Run(RegisterAsync);
        }
    }

    public static Plugin? Instance { get; private set; }

    /// <summary>True once Plugin Pages accepted the "Watch History" menu entry.</summary>
    public static bool PageRegistered { get; private set; }

    public override string Name => "TBD Watch History";

    public override Guid Id => PluginGuid;

    public override string Description => "Adds a per-user Watch History page to the Jellyfin web client.";

    public IEnumerable<PluginPageInfo> GetPages()
    {
        yield return new PluginPageInfo
        {
            Name = PageName,
            EmbeddedResourcePath = GetType().Namespace + ".web.watchhistory.html"
        };
    }

    private static async Task RegisterAsync()
    {
        bool transformDone = false;
        bool pageDone = false;

        for (int attempt = 0; attempt < 120 && !(transformDone && pageDone); attempt++)
        {
            if (!transformDone)
            {
                transformDone = TryRegister(".FileTransformation", "RegisterTransformation", TransformJson());
            }

            if (!pageDone)
            {
                pageDone = TryRegister(".PluginPages", "RegisterPage", PageJson());
                PageRegistered = pageDone;
            }

            if (!(transformDone && pageDone))
            {
                await Task.Delay(2000).ConfigureAwait(false);
            }
        }

        if (!transformDone)
        {
            Console.Error.WriteLine("[TBD Watch History] File Transformation plugin not found. Is it installed?");
        }

        if (!pageDone)
        {
            Console.Error.WriteLine("[TBD Watch History] Plugin Pages not found or refused the page. The floating button will be used instead.");
        }
    }

    private static bool TryRegister(string assemblyPart, string methodName, string json)
    {
        try
        {
            Assembly? assembly = AssemblyLoadContext.All
                .SelectMany(x => x.Assemblies)
                .FirstOrDefault(x => x.FullName?.Contains(assemblyPart) ?? false);

            if (assembly == null)
            {
                return false;
            }

            Type? interfaceType = assembly.GetTypes().FirstOrDefault(t => t.Name == "PluginInterface");
            MethodInfo? method = interfaceType?.GetMethod(methodName);

            if (method == null)
            {
                return false;
            }

            method.Invoke(null, new[] { BuildPayload(json, method.GetParameters()[0].ParameterType) });
            Console.WriteLine("[TBD Watch History] " + methodName + " succeeded.");
            return true;
        }
        catch (Exception ex)
        {
            Console.Error.WriteLine("[TBD Watch History] " + methodName + " attempt failed: " + (ex.InnerException?.Message ?? ex.Message));
            return false;
        }
    }

    private static string TransformJson() => JsonSerializer.Serialize(new
    {
        id = TransformGuid,
        fileNamePattern = "index.html",
        callbackAssembly = typeof(Plugin).Assembly.FullName,
        callbackClass = typeof(Transformer).FullName,
        callbackMethod = nameof(Transformer.Inject)
    });

    private static string PageJson() => JsonSerializer.Serialize(new
    {
        id = "tbd-watch-history",
        url = PageName,
        displayText = "Watch History",
        icon = "history"
    });

    private static object BuildPayload(string json, Type parameterType)
    {
        if (parameterType == typeof(string))
        {
            return json;
        }

        // Works for Newtonsoft JObject, which both plugins have used so far.
        MethodInfo? parse = parameterType.GetMethod("Parse", new[] { typeof(string) });
        if (parse != null)
        {
            return parse.Invoke(null, new object[] { json })!;
        }

        return JsonSerializer.Deserialize(json, parameterType)!;
    }
}
