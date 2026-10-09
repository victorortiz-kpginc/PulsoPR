namespace PulsoPR.Web.Models;

public sealed class PortalAuthState
{
    public AuthSession? Session { get; private set; }
    public bool Ready { get; private set; }
    public void Set(AuthSession? session) { Session = session; Ready = true; }
    public void Clear() { Session = null; Ready = true; }
    public bool CanView(string path) => Session?.Role switch
    {
        "admin" => !path.StartsWith("proveedor", StringComparison.Ordinal),
        "provider" => !path.StartsWith("admin", StringComparison.Ordinal),
        _ => false
    };
}

public sealed class AuthSession
{
    public string Id { get; set; } = "";
    public string Name { get; set; } = "";
    public string Email { get; set; } = "";
    public string? Role { get; set; }
    public string? TeamId { get; set; }
}
