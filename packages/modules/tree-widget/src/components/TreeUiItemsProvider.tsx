import { I18N } from "@bentley/imodeljs-i18n";
import {
  AbstractWidgetProps,
  StagePanelLocation,
  StagePanelSection,
  UiItemsProvider,
} from "@bentley/ui-abstract";
import { UiFramework, Widget } from "@bentley/ui-framework";
import { TreeWidgetControl } from "./TreeWidgetControl";
import React from "react";

/** Provides the property grid widget to zone 9 */
export class TreeUiItemsProvider implements UiItemsProvider {
  public readonly id = "TreeUiitemsProvider";
  public static i18n: I18N;

  public provideWidgets(
    _stageId: string,
    _stageUsage: string,
    location: StagePanelLocation,
    _section: StagePanelSection | undefined,
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (location === StagePanelLocation.Right) {
      widgets.push({
        id: "tree",
        getWidgetContent: () =>
          <Widget
            key={"DefaultTreeWidget"}
            control={TreeWidgetControl}
            fillZone={true}
            iconSpec="icon-tree"
            labelKey="iTwinViewer:components.tree"
            applicationData={{
              iModelConnection: UiFramework.getIModelConnection(),
              enableElementsClassGrouping: true,
            }}
          />
        ,
      });
    }

    return widgets;
  }
}