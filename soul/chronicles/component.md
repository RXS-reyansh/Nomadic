# Discord Components V2 — Full Reference

> Applies to discord.js **v14.26+** and Discord's Components V2 API.  
> Every message using Components V2 **must** include the flag:
> ```ts
> import { MessageFlags } from 'discord.js';
> flags: MessageFlags.IsComponentsV2
> ```
> Once this flag is set you cannot mix V2 components with classic embeds in the same message.

---

## Table of Contents
1. [Markdown in TextDisplay](#markdown)
2. [ContainerBuilder](#containerbuilder)
3. [TextDisplayBuilder](#textdisplaybuilder)
4. [SectionBuilder + ThumbnailBuilder](#sectionbuilder--thumbnailbuilder)
5. [SeparatorBuilder](#separatorbuilder)
6. [MediaGalleryBuilder](#mediagallerybuilder)
7. [FileBuilder](#filebuilder)
8. [ActionRowBuilder (Buttons & Selects)](#actionrowbuilder)
9. [Experimental / New Components](#experimental--new-components)
10. [What Is NOT Possible](#what-is-not-possible)
11. [Layout Cheat-Sheet](#layout-cheat-sheet)

---

## Markdown

`TextDisplayBuilder.setContent()` renders a **superset** of standard Discord markdown.  
Components V2 unlocks a few extras that do **not** work in regular messages.

### Standard markdown (works everywhere)
| Syntax | Result |
|---|---|
| `**text**` | **Bold** |
| `*text*` or `_text_` | *Italic* |
| `***text***` | ***Bold italic*** |
| `__text__` | Underline |
| `~~text~~` | ~~Strikethrough~~ |
| `\|\|text\|\|` | Spoiler (hidden until clicked) |
| `` `code` `` | Inline code |
| ` ```lang\ncode\n``` ` | Code block (with optional syntax highlight) |
| `> text` | Block quote |
| `>>> text` | Multi-line block quote |
| `- item` / `* item` | Unordered list |
| `1. item` | Ordered list |
| `[label](url)` | Masked hyperlink |
| `<@userId>` | User mention |
| `<#channelId>` | Channel mention |
| `<@&roleId>` | Role mention |
| `<:name:id>` / `<a:name:id>` | Custom emoji (static / animated) |
| `<t:unix>` | Timestamp (short date/time) |
| `<t:unix:R>` | Relative timestamp ("3 hours ago") |
| `<t:unix:F>` | Full timestamp |
| `<t:unix:D>` | Long date |
| `<t:unix:T>` | Long time |
| `<t:unix:d>` | Short date |
| `<t:unix:t>` | Short time |

### Components V2 extras (DO NOT work in normal messages)
| Syntax | Result |
|---|---|
| `# Heading` | Large H1 heading |
| `## Heading` | Medium H2 heading |
| `### Heading` | Small H3 heading |
| `-# text` | Subtext (small grey text, like a caption) |

### Markdown that does NOT exist in Discord
- Text alignment (no left / center / right)
- Tables
- Custom font size or color
- HTML tags of any kind

---

## ContainerBuilder

The **root wrapper** for every Components V2 message. Everything else lives inside it.

```ts
import { ContainerBuilder, MessageFlags } from 'discord.js';

const container = new ContainerBuilder()
  .setAccentColor(0xb4f8c8)   // left-side colour stripe (any hex int)
  .setSpoiler(false);          // wraps entire container in a spoiler blur

// Add child components:
container.addTextDisplayComponents(...)
container.addSectionComponents(...)
container.addSeparatorComponents(...)
container.addMediaGalleryComponents(...)
container.addFileComponents(...)
container.addActionRowComponents(...)
```

- A message can hold **multiple containers** (each is its own visual card).
- `setAccentColor` accepts a hex integer (`0xRRGGBB`) — this is the coloured left border.
- `clearAccentColor()` removes the accent.
- `setSpoiler(true)` blurs the whole container like a spoiler image.

---

## TextDisplayBuilder

Renders markdown text. The most-used component.

```ts
import { TextDisplayBuilder } from 'discord.js';

new TextDisplayBuilder().setContent(
  `# Big heading\n` +
  `Some **bold** and *italic* text.\n` +
  `-# Small subtext caption below`
);
```

- No alignment control. Text is always left-aligned.
- Newlines (`\n`) work as expected.
- Can contain any markdown from the table above.

---

## SectionBuilder + ThumbnailBuilder

A **Section** renders text on the left and either a **Thumbnail** or a **Button** as an accessory on the right. This is the only way to display an image inline with text.

```ts
import { SectionBuilder, ThumbnailBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

// Thumbnail accessory
const section = new SectionBuilder()
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent('## Title\nSome description text here.'),
  )
  .setThumbnailAccessory(
    new ThumbnailBuilder()
      .setURL('https://example.com/image.png')
      .setDescription('Alt text for accessibility')  // optional
      .setSpoiler(false),                             // optional
  );

// Button accessory (instead of thumbnail)
const sectionWithButton = new SectionBuilder()
  .addTextDisplayComponents(
    new TextDisplayBuilder().setContent('Click the button →'),
  )
  .setButtonAccessory(
    new ButtonBuilder()
      .setLabel('Go')
      .setStyle(ButtonStyle.Primary)
      .setCustomId('my_button'),
  );
```

### Multiple thumbnails
Each `SectionBuilder` holds one thumbnail. Stack sections with separators between them for multiple thumbnails:

```
ContainerBuilder
  ├─ SectionBuilder  (.setThumbnailAccessory → image A)
  ├─ SeparatorBuilder
  ├─ SectionBuilder  (.setThumbnailAccessory → image B)
  ├─ SeparatorBuilder
  └─ SectionBuilder  (.setThumbnailAccessory → image C)
```

### Rules
- A section can have **one** accessory: either a Thumbnail **or** a Button — not both.
- The text content is always on the left; the accessory is always on the right.
- Thumbnail image sources must be a fully qualified HTTPS URL.
- Use `attachment://filename.png` for uploaded attachments.
- Thumbnail height determines the section height — tall images create tall sections.

---

## SeparatorBuilder

A horizontal rule / whitespace divider between components.

```ts
import { SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';

new SeparatorBuilder()
  .setDivider(true)                            // true = visible line, false = invisible gap
  .setSpacing(SeparatorSpacingSize.Small);     // Small (default) or Large
```

| `setDivider` | `setSpacing` | Visual result |
|---|---|---|
| `true` | `Small` | Thin line, small gap |
| `true` | `Large` | Thin line, larger gap |
| `false` | `Small` | Invisible small gap (breathing room) |
| `false` | `Large` | Invisible large gap |

---

## MediaGalleryBuilder

Displays **1–10 images or videos** in an auto-layout grid. Aspect ratio / grid shape adjusts based on item count (similar to how Discord shows image attachments).

```ts
import { MediaGalleryBuilder, MediaGalleryItemBuilder } from 'discord.js';

const gallery = new MediaGalleryBuilder().addItems(
  new MediaGalleryItemBuilder()
    .setURL('https://example.com/photo1.png')
    .setDescription('Caption shown on hover')  // optional
    .setSpoiler(false),                         // optional
  new MediaGalleryItemBuilder()
    .setURL('https://example.com/photo2.gif'),
  new MediaGalleryItemBuilder()
    .setURL('attachment://local.png'),
);
```

- Supports images and video URLs (mp4, gif, etc.).
- `setDescription` sets the alt/caption text.
- 1 item = full width. 2 items = side by side. 3+ = grid layout.
- `spliceItems(index, deleteCount, ...items)` for precise control.

---

## FileBuilder

Displays a file attachment as a named downloadable link block (like when you upload a file to Discord normally).

```ts
import { FileBuilder } from 'discord.js';

new FileBuilder()
  .setURL('attachment://report.pdf')  // must use attachment:// prefix
  .setSpoiler(false);
```

- Only works with `attachment://filename` URLs — the file must be uploaded in the same message's `files` array.
- Cannot link to external URLs.

---

## ActionRowBuilder

Buttons and select menus. Works the same as in classic Discord messages.

### Buttons

```ts
import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';

new ActionRowBuilder().addComponents(
  new ButtonBuilder().setLabel('Primary')  .setStyle(ButtonStyle.Primary)  .setCustomId('btn_primary'),
  new ButtonBuilder().setLabel('Secondary').setStyle(ButtonStyle.Secondary).setCustomId('btn_secondary'),
  new ButtonBuilder().setLabel('Success')  .setStyle(ButtonStyle.Success)  .setCustomId('btn_success'),
  new ButtonBuilder().setLabel('Danger')   .setStyle(ButtonStyle.Danger)   .setCustomId('btn_danger'),
  new ButtonBuilder().setLabel('Link')     .setStyle(ButtonStyle.Link)     .setURL('https://example.com'),
);
```

| Style | Value | Colour |
|---|---|---|
| `Primary` | 1 | Blue |
| `Secondary` | 2 | Grey |
| `Success` | 3 | Green |
| `Danger` | 4 | Red |
| `Link` | 5 | Grey (opens URL, no interaction event) |
| `Premium` | 6 | Purple (SKU-based, for monetisation) |

Button extras:
```ts
button
  .setEmoji({ id: '123', name: 'wave', animated: false })  // custom emoji
  .setEmoji({ name: '👋' })                                 // unicode emoji
  .setDisabled(true);
```

- Max **5 buttons** per `ActionRowBuilder`.
- Max **5 ActionRows** per container.

### Select menus

```ts
import { StringSelectMenuBuilder, StringSelectMenuOptionBuilder } from 'discord.js';

new ActionRowBuilder().addComponents(
  new StringSelectMenuBuilder()
    .setCustomId('my_select')
    .setPlaceholder('Choose an option')
    .setMinValues(1)
    .setMaxValues(1)
    .addOptions(
      new StringSelectMenuOptionBuilder().setValue('a').setLabel('Option A').setDescription('desc'),
      new StringSelectMenuOptionBuilder().setValue('b').setLabel('Option B').setEmoji({ name: '🎵' }),
    )
    .setDisabled(false),
);
```

Other select types: `UserSelectMenuBuilder`, `RoleSelectMenuBuilder`, `MentionableSelectMenuBuilder`, `ChannelSelectMenuBuilder`.

---

## Experimental / New Components

These are exported by discord.js v14.26 but are still rolling out on Discord's end. They may not render for all users or guilds yet.

### RadioGroupBuilder

A set of mutually exclusive radio options (select one).

```ts
import { RadioGroupBuilder, RadioGroupOptionBuilder } from 'discord.js';

new RadioGroupBuilder()
  .setCustomId('my_radio')
  .setRequired(true)
  .addOptions(
    new RadioGroupOptionBuilder().setLabel('Option A').setValue('a').setDefault(true),
    new RadioGroupOptionBuilder().setLabel('Option B').setValue('b').setDescription('Optional desc'),
  );
```

### CheckboxGroupBuilder

A group of checkboxes (select one or many).

```ts
import { CheckboxGroupBuilder, CheckboxGroupOptionBuilder } from 'discord.js';

new CheckboxGroupBuilder()
  .setCustomId('my_checkboxes')
  .setMinValues(1)
  .setMaxValues(3)
  .setRequired(false)
  .addOptions(
    new CheckboxGroupOptionBuilder().setLabel('Choice 1').setValue('c1').setDefault(false),
    new CheckboxGroupOptionBuilder().setLabel('Choice 2').setValue('c2'),
  );
```

### FileUploadBuilder

An interactive file upload field (within a modal / form flow).

```ts
import { FileUploadBuilder } from 'discord.js';

new FileUploadBuilder()
  .setCustomId('my_upload')
  .setRequired(true)
  .setMinValues(1)
  .setMaxValues(3);
```

### LabelBuilder

A label that can be associated with any input component (text input, select, checkbox, etc.) to provide a visible heading/description for a form field.

```ts
import { LabelBuilder } from 'discord.js';

new LabelBuilder()
  .setLabel('Your answer')
  .setDescription('Enter anything you like')
  .setTextInputComponent(myTextInput);
```

---

## What Is NOT Possible

| Feature | Status |
|---|---|
| Text alignment (center / right) | **Not possible** — no markdown or API option for this |
| Per-text font size | **Not possible** — only `#`, `##`, `###`, `-#` affect size |
| Text colour | **Not possible** — no colour markdown or component property |
| Inline images (image inside a text flow) | **Not possible** — images are only via Thumbnail (in Section) or MediaGallery |
| Standalone thumbnail (without a Section) | **Not possible** — ThumbnailBuilder is only a Section accessory |
| Mixing V2 components with classic embeds | **Not possible** in the same message |
| Tables | **Not possible** — no table markdown |
| HTML / CSS | **Not possible** — completely ignored |

---

## Layout Cheat-Sheet

```
ContainerBuilder  [setAccentColor, setSpoiler]
│
├─ TextDisplayBuilder          → markdown text block
│
├─ SectionBuilder              → text LEFT + accessory RIGHT
│   ├─ TextDisplayBuilder(s)   → the left-side text (can stack multiple)
│   └─ ThumbnailBuilder        → right-side image  (OR ButtonBuilder)
│
├─ SeparatorBuilder            → horizontal rule or gap
│   [setDivider, setSpacing: Small | Large]
│
├─ MediaGalleryBuilder         → image/video grid (1–10 items)
│   └─ MediaGalleryItemBuilder(s)  [setURL, setDescription, setSpoiler]
│
├─ FileBuilder                 → downloadable file block (attachment:// only)
│
└─ ActionRowBuilder            → interactive row
    ├─ ButtonBuilder(s)        → up to 5 buttons per row
    └─ SelectMenuBuilder       → one select menu per row

── Experimental ──
    RadioGroupBuilder          → single-choice radio
    CheckboxGroupBuilder       → multi-choice checkboxes
    FileUploadBuilder          → file upload field
    LabelBuilder               → form field label
```

### Tips
- **Accent colour** is just the left border stripe on the container — it does not colour text.
- **Multiple thumbnails** → use multiple SectionBuilders.
- **Image gallery** → use MediaGalleryBuilder, not multiple ThumbnailBuilders.
- **Subtext** (`-#`) is great for footers, disclaimers, and small captions without a full separator.
- A `SeparatorBuilder` with `setDivider(false)` is just breathing room — useful for padding between text blocks without drawing a line.
- Containers can be **nested** conceptually by sending multiple container objects in the `components` array.
