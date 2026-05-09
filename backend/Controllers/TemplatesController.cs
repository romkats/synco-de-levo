using SyncoDeLevo.Api.Services;
using Microsoft.AspNetCore.Mvc;

namespace SyncoDeLevo.Api.Controllers;

[ApiController]
[Route("api/templates")]
public class TemplatesController : ControllerBase
{
    private readonly ITemplateService _templates;
    public TemplatesController(ITemplateService templates) => _templates = templates;

    [HttpGet]
    public IActionResult List() => Ok(_templates.List().Select(t => new
    {
        t.Id, t.Name, t.Description, LevelCount = t.Levels.Count
    }));

    [HttpGet("{id}")]
    public IActionResult Get(string id)
    {
        var t = _templates.Get(id);
        return t is null ? NotFound() : Ok(t);
    }
}
