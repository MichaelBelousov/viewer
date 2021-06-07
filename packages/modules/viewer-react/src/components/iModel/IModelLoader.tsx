/*---------------------------------------------------------------------------------------------
 * Copyright (c) Bentley Systems, Incorporated. All rights reserved.
 * See LICENSE.md in the project root for license terms and full copyright notice.
 *--------------------------------------------------------------------------------------------*/

import "@bentley/icons-generic-webfont/dist/bentley-icons-generic-webfont.css";
import "./IModelLoader.scss";

import {
  BlankConnection,
  BlankConnectionProps,
  IModelApp,
  IModelConnection,
  SnapshotConnection,
  ViewState,
  FitViewTool,
} from "@bentley/imodeljs-frontend";
import {
  BackstageActionItem,
  BackstageItemUtilities,
  BackstageStageLauncher,
} from "@bentley/ui-abstract";
import {
  StateManager,
  SyncUiEventDispatcher,
  UiFramework,
} from "@bentley/ui-framework";
import { useErrorManager } from "@itwin/error-handling-react";
import { withAITracking } from "@microsoft/applicationinsights-react-js";
import React, { useEffect, useState } from "react";
import { Provider } from "react-redux";

import { useTheme, useUiProviders } from "../../hooks";
//import { BaseInitializer } from "../../services/BaseInitializer";
import {
  getDefaultViewIds,
  openRemoteImodel,
} from "../../services/iModel/IModelService";
import { ViewCreator } from "../../services/iModel/ViewCreator";
import { ai } from "../../services/telemetry/TelemetryService";
import {
  BlankConnectionViewState,
  IModelLoaderParams,
  ViewerBackstageItem,
  ViewerFrontstage,
} from "../../types";
import { DefaultFrontstage } from "../app-ui/frontstages/DefaultFrontstage";
import { IModelBusy, IModelViewer } from ".";

export interface ModelLoaderProps extends IModelLoaderParams {
  contextId?: string;
  iModelId?: string;
  changeSetId?: string;
  appInsightsKey?: string;
  snapshotPath?: string;
  blankConnection?: BlankConnectionProps;
  blankConnectionViewState?: BlankConnectionViewState;
}

const Loader: React.FC<ModelLoaderProps> = React.memo(
  ({
    iModelId,
    contextId,
    changeSetId,
    defaultUiConfig,
    onIModelConnected,
    snapshotPath,
    frontstages,
    backstageItems,
    uiFrameworkVersion,
    viewportOptions,
    blankConnection,
    blankConnectionViewState,
    uiProviders,
    theme,
  }: ModelLoaderProps) => {
    const [error, setError] = useState<Error>();
    const [finalFrontstages, setFinalFrontstages] =
      useState<ViewerFrontstage[]>();
    const [finalBackstageItems, setFinalBackstageItems] =
      useState<ViewerBackstageItem[]>();
    const [viewState, setViewState] = useState<ViewState>();
    const [connected, setConnected] = useState<boolean>(false);

    useUiProviders(uiProviders);
    useTheme(theme);

    // trigger error boundary when fatal error is thrown
    const errorManager = useErrorManager({});
    useEffect(() => {
      setError(errorManager.fatalError);
    }, [errorManager.fatalError]);

    /**
     * Initialize a blank connection and viewState
     * @param blankConnection
     */
    const initBlankConnection = (
      blankConnection: BlankConnectionProps,
      viewStateOptions?: BlankConnectionViewState,
      onIModelConnected?: (iModel: IModelConnection) => void
    ) => {
      const imodelConnection = BlankConnection.create(blankConnection);
      const viewState = ViewCreator.createBlankViewState(
        imodelConnection,
        viewStateOptions
      );
      UiFramework.setIModelConnection(imodelConnection);

      if (onIModelConnected) {
        onIModelConnected(imodelConnection);
      }

      UiFramework.setDefaultViewState(viewState);
      setViewState(viewState);
      setConnected(true);
    };

    useEffect(() => {
      const getModelConnection = async () => {
        // first check to see if some other frontstage is defined as the default
        // allow fronstages other than the default viewport to continue to render if so
        if (frontstages) {
          const defaultFrontstages = frontstages.filter(
            (frontstage) => frontstage.default
          );
          if (defaultFrontstages.length > 0) {
            // there should only be one, but check if any default frontstage requires an iModel connection
            let requiresConnection = false;
            for (let i = 0; i < defaultFrontstages.length; i++) {
              if (defaultFrontstages[i].requiresIModelConnection) {
                requiresConnection = true;
                break;
              }
            }
            if (!requiresConnection) {
              // allow to continue to render
              setConnected(true);
              return;
            }
          }
        }

        setConnected(false);

        if (blankConnection) {
          return initBlankConnection(
            blankConnection,
            blankConnectionViewState,
            onIModelConnected
          );
        }

        if (!(contextId && iModelId) && !snapshotPath) {
          throw new Error(
            IModelApp.i18n.translateWithNamespace(
              "iTwinViewer",
              "missingConnectionProps"
            )
          );
        }

        let imodelConnection: IModelConnection | undefined;
        // create a new imodelConnection for the passed project and imodel ids
        // TODO add the ability to open a BriefcaseConnection for Electron apps
        if (snapshotPath) {
          imodelConnection = await SnapshotConnection.openFile(snapshotPath);
        } else if (contextId && iModelId) {
          imodelConnection = await openRemoteImodel(
            contextId,
            iModelId,
            changeSetId
          );
        }
        if (imodelConnection) {
          // Tell the SyncUiEventDispatcher and StateManager about the iModelConnection
          UiFramework.setIModelConnection(imodelConnection);

          SyncUiEventDispatcher.initializeConnectionEvents(imodelConnection);

          if (onIModelConnected) {
            onIModelConnected(imodelConnection);
          }

          let viewId: string | undefined = await getDefaultViewIds(imodelConnection);
          if (viewId !== undefined) {
            try {
              await imodelConnection.views.load(viewId);
            } catch (e) {
              console.error(
                "Problem loading default view, creating default view instead: " + e,
              );
              // If we fail, just keep going
              viewId = undefined;
            }
          }

          viewId = undefined;

          // attempt to construct a default viewState
          const savedViewState = await ViewCreator.createDefaultView(
            imodelConnection,
            undefined,
            viewId !== undefined ? viewId : undefined
          );

          //console.log(savedViewState);

          // Should not be undefined
          if (!savedViewState) {
            throw new Error("No default view state for the imodel!");
          }

            // console.log(IModelApp.viewManager.getFirstOpenView())
            // // Set Isometric and Fit View
            // if (IModelApp.viewManager.getFirstOpenView() !== undefined) {
            //   (IModelApp.viewManager.getFirstOpenView() as ScreenViewport).setStandardRotation(StandardViewId.Iso);
            //   ViewManip.fitView((IModelApp.viewManager.getFirstOpenView() as ScreenViewport), false);
            //   console.log("fitting vp");
            // }
            // Turn on sub-categories
            // vp.changeCategoryDisplay(categories, true, true);

          // Set default view state
          UiFramework.setDefaultViewState(savedViewState);

          //const categories = await ViewCreator.getAllCategories(imodelConnection);
          //Setup an action so that we fit the view when going into the frontstage
          const setupViewports = async () => {
            //IModelApp.viewManager.forEachViewport((vp) => {
              // Set Isometric and Fit View
              //IModelApp.viewManager._viewports.setStandardRotation(StandardViewId.Iso);
              //ViewManip.fitView(IModelApp.viewManager._viewports, false);
              //console.log("fitting vp")
              // Turn on sub-categories
              // vp.changeCategoryDisplay(categories, true, true);
              //IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager.selectedView, true);

              IModelApp.tools.run(FitViewTool.toolId, IModelApp.viewManager._viewports[0], true);
            //});
          };

          // TODO revist for snapshots once settings are removed
          if (!snapshotPath) {
            UiFramework.setActiveSelectionScope("top-assembly");
          }

          setViewState(savedViewState);
          setupViewports();
          setConnected(true);
          //console.log('setup');
        }
      };

      const closeIModelConnection = async () => {
        const iModelConn = UiFramework.getIModelConnection();
        if (iModelConn) {
          await iModelConn.close();
        }
      };

      getModelConnection().catch((error) => {
        errorManager.throwFatalError(error);
      });

      return () => {
        closeIModelConnection().catch(() => {
          /* no-op */
        });
      };
    }, [
      contextId,
      iModelId,
      changeSetId,
      snapshotPath,
      frontstages,
      blankConnection,
      blankConnectionViewState,
    ]);

    useEffect(() => {
      const allBackstageItems: ViewerBackstageItem[] = [];
      if (backstageItems) {
        backstageItems.forEach((backstageItem) => {
          // check for label i18n key and translate if needed
          if (backstageItem.labeli18nKey) {
            let newItem;
            if ((backstageItem as BackstageStageLauncher).stageId) {
              newItem = BackstageItemUtilities.createStageLauncher(
                (backstageItem as BackstageStageLauncher).stageId,
                backstageItem.groupPriority,
                backstageItem.itemPriority,
                IModelApp.i18n.translate(backstageItem.labeli18nKey),
                backstageItem.subtitle,
                backstageItem.icon
              );
            } else {
              newItem = BackstageItemUtilities.createActionItem(
                backstageItem.id,
                backstageItem.groupPriority,
                backstageItem.itemPriority,
                (backstageItem as BackstageActionItem).execute,
                IModelApp.i18n.translate(backstageItem.labeli18nKey),
                backstageItem.subtitle,
                backstageItem.icon
              );
            }
            allBackstageItems.push(newItem);
          } else {
            allBackstageItems.push(backstageItem);
          }
        });
      }

      if (viewState) {
        allBackstageItems.unshift({
          stageId: "DefaultFrontstage",
          id: "DefaultFrontstage",
          groupPriority: 100,
          itemPriority: 10,
          label: IModelApp.i18n.translate(
            "iTwinViewer:backstage.mainFrontstage"
          ),
        });
      }

      setFinalBackstageItems(allBackstageItems);
    }, [backstageItems, viewState]);

    useEffect(() => {
      let allFrontstages: ViewerFrontstage[] = [];
      if (frontstages) {
        allFrontstages = [...frontstages];
      }

      if (viewState) {
        // initialize the DefaultFrontstage that contains the views that we want
        const defaultFrontstageProvider = new DefaultFrontstage(
          [viewState],
          defaultUiConfig,
          viewportOptions
        );

        // add the default frontstage first so that it's default status can be overridden
        allFrontstages.unshift({
          provider: defaultFrontstageProvider,
          default: true,
        });
      }

      setFinalFrontstages(allFrontstages);
    }, [frontstages, viewportOptions, viewState]);

    if (error) {
      throw error;
    } else {
      return (
        <div className="itwin-viewer-container">
          {finalFrontstages &&
            finalBackstageItems &&
            connected &&
            StateManager.store ? (
            <Provider store={StateManager.store}>
              <IModelViewer
                frontstages={finalFrontstages}
                backstageItems={finalBackstageItems}
                uiFrameworkVersion={uiFrameworkVersion}
              />
            </Provider>
          ) : (
            <div className="itwin-viewer-loading-container">
              <IModelBusy />
            </div>
          )}
        </div>
      );
    }
  }
);

const TrackedLoader = withAITracking(ai.reactPlugin, Loader, "IModelLoader");

const IModelLoader: React.FC<ModelLoaderProps> = (props: ModelLoaderProps) => {
  if (props.appInsightsKey) {
    return <TrackedLoader {...props} />;
  } else {
    return <Loader {...props} />;
  }
};

export default IModelLoader;
