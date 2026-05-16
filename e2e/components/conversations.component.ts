import { expect, Locator } from "@playwright/test";

export class ConversationsComponent {
  private readonly root: Locator;

  constructor(root: Locator) {
    this.root = root;
  }

  /** Locator for the <shadow-claw-conversations> element */
  host(): Locator {
    return this.root.locator("shadow-claw-conversations");
  }

  /** All conversation items in the list */
  items(): Locator {
    return this.host().locator(".conversation-item");
  }

  /** A specific conversation item by group ID */
  item(groupId: string): Locator {
    return this.host().locator(
      `.conversation-item[data-group-id="${groupId}"]`,
    );
  }

  /** The active (selected) conversation */
  activeItem(): Locator {
    return this.host().locator(".conversation-item.active");
  }

  /** Get the name text of a conversation item */
  itemName(locator: Locator): Locator {
    return locator.locator(".conversation-name");
  }

  /** The "+" create button */
  createButton(): Locator {
    return this.host().locator('[data-action="create"]');
  }

  createDialog(): Locator {
    return this.host().locator(".conversations__create-dialog");
  }

  createInput(): Locator {
    return this.host().locator(
      ".conversations__create-dialog .conversations__input",
    );
  }

  createOkButton(): Locator {
    return this.host().locator(
      ".conversations__create-dialog .conversations__ok",
    );
  }

  /** Details button inside a conversation item (visible on hover) */
  detailsButton(itemLocator: Locator): Locator {
    return itemLocator.locator('[data-action="details"]');
  }

  detailsDialog(): Locator {
    return this.host().locator(".conversations__details-dialog");
  }

  detailsInput(): Locator {
    return this.host().locator(
      ".conversations__details-dialog input#conversations-details-name",
    );
  }

  detailsOkButton(): Locator {
    return this.host().locator(
      ".conversations__details-dialog .conversations__ok",
    );
  }

  /** Delete button inside a conversation item (visible on hover) */
  deleteButton(itemLocator: Locator): Locator {
    return itemLocator.locator('[data-action="delete"]');
  }

  deleteDialog(): Locator {
    return this.host().locator(".conversations__delete-dialog");
  }

  deleteOkButton(): Locator {
    return this.host().locator(
      ".conversations__delete-dialog .conversations__delete-ok",
    );
  }

  deleteCancelButton(): Locator {
    return this.host().locator(
      ".conversations__delete-dialog .conversations__cancel",
    );
  }

  /** Count of conversations in the list */
  async count(): Promise<number> {
    return this.items().count();
  }

  /** Get the name of the active conversation */
  async activeConversationName(): Promise<string | null> {
    const text = await this.itemName(this.activeItem()).textContent();

    return text?.trim() ?? null;
  }

  /** Wait for a certain number of conversations */
  async expectCount(count: number) {
    await expect(this.items()).toHaveCount(count, { timeout: 10000 });
  }

  async createConversation(name: string) {
    await this.createButton().click();
    await expect(this.createDialog()).toHaveJSProperty("open", true);
    await this.createInput().fill(name);
    await this.createOkButton().click();
  }

  async editConversationDetails(itemLocator: Locator, name: string) {
    await itemLocator.hover();
    await this.detailsButton(itemLocator).click();
    await expect(this.detailsDialog()).toHaveJSProperty("open", true);
    await this.detailsInput().fill(name);
    await this.detailsOkButton().click();
  }

  async deleteConversation(itemLocator: Locator, confirmDelete: boolean) {
    await itemLocator.hover();
    await this.deleteButton(itemLocator).click();
    await expect(this.deleteDialog()).toHaveJSProperty("open", true);

    if (confirmDelete) {
      await this.deleteOkButton().click();

      return;
    }

    await this.deleteCancelButton().click();
  }
}
