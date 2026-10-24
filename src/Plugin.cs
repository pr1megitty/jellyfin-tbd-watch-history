using System.Reflection;
using System.Runtime.Loader;
using System.Text.Json;
using MediaBrowser.Common.Configuration;
using MediaBrowser.Common.Plugins;
using MediaBrowser.Model.Plugins;
using MediaBrowser.Model.Serialization;

namespace Jellyfin.Plugin.TbdWatchHistory;

/// <summary>
/// TBD Watch History. Injects a self-contained "Watch History" page into jellyfin-web
/// through the File Transformation plugin.
/// </summary>
public class Plugin : BasePlugin<BasePluginConfiguration>
{
    private static readonly Guid PluginGuid = Guid.Parse("7a0b5df1-bb7b-4a0b-add5-8afe03e880f0");
    private static readonly Guid TransformGuid = Guid.Parse("3c1f9d52-6e0a-4c43-9b7e-5d2a8f1e4b60");
    private static int _registering;

    public Plugin(IApplicationPaths applicationPaths, IXmlSerializer xmlSerializer)
        : base(applicationPaths, xmlSerializer)
    {
        Instance = this;

        // File Transformation may load after this plugin, so retry until it shows up.
        if (Interlocked.Exchange(ref _registering, 1) == 0)
        {
            _ = Task.Run(RegisterAsync);
        }
    }

    public static Plugin? Instance { get; private set; }

    public override string Name => "TBD Watch History";

    public override Guid Id => PluginGuid;

    public override string Description => "Adds a per-user Watch History page to the Jellyfin web client.";

    private static async Task RegisterAsync()
    {
        for (int attempt = 0; attempt < 120; attempt++)
        {
            try
            {
                Assembly? assembly = AssemblyLoadContext.All
                    .SelectMany(x => x.Assemblies)
                    .FirstOrDefault(x => x.FullName?.Contains(".FileTransformation") ?? false);

                Type? interfaceType = assembly?.GetType("Jellyfin.Plugin.FileTransformation.PluginInterface");
                MethodInfo? method = interfaceType?.GetMethod("RegisterTransformation");

                if (method != null)
                {
                    object payload = BuildPayload(method.GetParameters()[0].ParameterType);
                    method.Invoke(null, new[] { payload });
                    Console.WriteLine("[TBD Watch History] Registered with File Transformation.");
                    return;
                }
            }
            catch (Exception ex)
            {
                Console.Error.WriteLine("[TBD Watch History] Registration attempt failed: " + ex.Message);
            }

            await Task.Delay(2000).ConfigureAwait(false);
        }

        Console.Error.WriteLine("[TBD Watch History] File Transformation plugin not found. Is it installed?");
    }

    private static object BuildPayload(Type parameterType)
    {
        string json = JsonSerializer.Serialize(new
        {
            id = TransformGuid,
            fileNamePattern = @"index\.html",
            callbackAssembly = typeof(Plugin).Assembly.FullName,
            callbackClass = typeof(Transformer).FullName,
            callbackMethod = nameof(Transformer.Inject)
        });

        if (parameterType == typeof(string))
        {
            return json;
        }

        // Works for Newtonsoft JObject, which File Transformation has used so far.
        MethodInfo? parse = parameterType.GetMethod("Parse", new[] { typeof(string) });
        if (parse != null)
        {
            return parse.Invoke(null, new object[] { json })!;
        }

        return JsonSerializer.Deserialize(json, parameterType)!;
    }
}
