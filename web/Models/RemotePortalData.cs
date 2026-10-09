namespace PulsoPR.Web.Models;

public sealed class RemotePortalData
{
    public List<ProviderView> Providers { get; set; } = [];
    public List<RemoteRequestView> Requests { get; set; } = [];
    public List<RemoteHistoryEntry> History { get; set; } = [];
}

public sealed class RemoteRequestView
{
    public string Id { get; set; } = "";
    public string FacilityId { get; set; } = "";
    public string Description { get; set; } = "";
    public string Status { get; set; } = "submitted";
    public DateTimeOffset CreatedAt { get; set; }
    public List<RemoteRequestEvent> Events { get; set; } = [];
}

public sealed class RemoteRequestEvent
{
    public string State { get; set; } = "submitted";
    public DateTimeOffset Time { get; set; }
    public string Note { get; set; } = "";
}

public sealed class RemoteHistoryEntry
{
    public string FacilityId { get; set; } = "";
    public DateTimeOffset Time { get; set; }
    public string Title { get; set; } = "";
    public string Note { get; set; } = "";
}
