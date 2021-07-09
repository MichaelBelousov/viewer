import {
  AbstractWidgetProps,
  StagePanelLocation,
  StagePanelSection,
  StageUsage,
  UiItemsProvider,
} from "@bentley/ui-abstract";
import {
  SpatialContainmentTree,
  ClassGroupingOption
} from "@bentley/ui-framework";
import React from "react";
import { TreeWidgetComponent } from "./TreeWidgetComponent";
import { CategoriesTreeComponent } from "./trees/CategoriesTree";
import { ModelsTreeComponent } from "./trees/ModelsTree";
import { TreeWidgetControlOptions } from "./TreeWidgetControl";
import { IModelConnection, Viewport } from "@bentley/imodeljs-frontend";
import { SelectableContentDefinition } from "@bentley/ui-components";
import { TreeWidget } from "../TreeWidget";

export class TreeUiItemsProvider implements UiItemsProvider {
  public readonly id = "TreeUiitemsProvider";

  private _imodel: IModelConnection;
  private _activeView?: Viewport;
  private _enablePreloading?: boolean;
  private _enableElementsClassGrouping?: boolean;
  private _allViewports?: boolean;
  private _additionalTrees?: SelectableContentDefinition[];
  private _modelsTreeProps?: {};
  private _categoriesTreeProps?: {};
  private _spatialTreeProps?: {};
  private _modelsTreeReplacement?: () => React.ReactNode;
  private _categoriesTreeReplacement?: () => React.ReactNode;
  private _spatialTreeReplacement?: () => React.ReactNode;

  constructor(props: TreeWidgetControlOptions) {
    this._imodel = props.iModelConnection;
    this._activeView = props.activeView;
    this._enablePreloading = props.enablePreloading;
    this._enableElementsClassGrouping = props.enableElementsClassGrouping;
    this._allViewports = props.allViewports;
    this._additionalTrees = props.additionalTrees;
    this._modelsTreeProps = props.additionalProps?.modelsTree;
    this._categoriesTreeProps = props.additionalProps?.categoriesTree;
    this._spatialTreeProps = props.additionalProps?.spatialTree;
    this._modelsTreeReplacement = props.treeReplacements?.modelsTree;
    this._categoriesTreeReplacement = props.treeReplacements?.categoriesTree;
    this._spatialTreeReplacement = props.treeReplacements?.spatialTree;
  }

  public provideWidgets(
    _stageId: string,
    stageUsage: string,
    location: StagePanelLocation,
    _section: StagePanelSection | undefined,
  ): ReadonlyArray<AbstractWidgetProps> {
    const widgets: AbstractWidgetProps[] = [];
    if (
      stageUsage === StageUsage.General &&
      location === StagePanelLocation.Right
    ) {

      const modelsTreeComponent = (
        <ModelsTreeComponent
          iModel={this._imodel}
          allViewports={this._allViewports}
          activeView={this._activeView}
          enablePreloading={this._enablePreloading}
          enableElementsClassGrouping={this._enableElementsClassGrouping}
          {...this._modelsTreeProps}
        />
      );

      const categoriesTreeComponent = (
        <CategoriesTreeComponent
          iModel={this._imodel}
          allViewports={this._allViewports}
          activeView={this._activeView}
          enablePreloading={this._enablePreloading}
          {...this._categoriesTreeProps}
        />
      );

      const spatialContainmentComponent = (
        <SpatialContainmentTree
          iModel={this._imodel}
          enablePreloading={this._enablePreloading}
          enableElementsClassGrouping={
            this._enableElementsClassGrouping
              ? ClassGroupingOption.Yes
              : ClassGroupingOption.No
          }
          {...this._spatialTreeProps}
        />
      );

      const trees: SelectableContentDefinition[] = [
        {
          label: TreeWidget.translate("visibilityWidget.modeltree"),
          id: "model-tree",
          render: this._modelsTreeReplacement ? this._modelsTreeReplacement : () => modelsTreeComponent,
        },
        {
          label: TreeWidget.translate("visibilityWidget.categories"),
          id: "categories-tree",
          render: this._categoriesTreeReplacement ? this._categoriesTreeReplacement : () => categoriesTreeComponent,
        },
        {
          label: TreeWidget.translate("visibilityWidget.containment"),
          id: "spatial-containment-tree",
          render: this._spatialTreeReplacement ? this._spatialTreeReplacement : () => spatialContainmentComponent,
        },
      ];

      if (this._additionalTrees) {
        trees.push(...this._additionalTrees);
      }

      widgets.push({
        id: "tree",
        label: "Tree View",
        getWidgetContent: () =>
          <TreeWidgetComponent trees={trees} />
        ,
      });
    }

    return widgets;
  }
}