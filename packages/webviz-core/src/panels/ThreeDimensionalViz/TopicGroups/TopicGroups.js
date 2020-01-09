// @flow
//
//  Copyright (c) 2018-present, Cruise LLC
//
//  This source code is licensed under the Apache License, Version 2.0,
//  found in the LICENSE file in the root directory of this source tree.
//  You may not use this file except in compliance with the License.

import ChevronDownIcon from "@mdi/svg/svg/chevron-down.svg";
import ChevronUpIcon from "@mdi/svg/svg/chevron-up.svg";
import LayersIcon from "@mdi/svg/svg/layers.svg";
import PinIcon from "@mdi/svg/svg/pin.svg";
import { omit, set, cloneDeep, compact } from "lodash";
import Collapse from "rc-collapse";
import React, { useState, useCallback, useMemo } from "react";
import ReactDOM from "react-dom";
import styled from "styled-components";

import { type Save3DConfig } from "../index";
import TopicGroupBody from "./TopicGroupBody";
import TopicGroupHeader, { STopicGroupName, SEyeIcon } from "./TopicGroupHeader";
import { SMenuWrapper } from "./TopicGroupMenu";
import {
  getTopicGroups,
  buildItemDisplayNameByTopicOrExtension,
  buildAvailableNamespacesByTopic,
  TOPIC_CONFIG,
} from "./topicGroupsUtils";
import TopicSettingsEditor from "./TopicSettingsEditor";
import type { TopicGroupConfig, TopicGroupType } from "./types";
import ChildToggle from "webviz-core/src/components/ChildToggle";
import Icon from "webviz-core/src/components/Icon";
import Modal from "webviz-core/src/components/Modal";
import { RenderToBodyComponent } from "webviz-core/src/components/renderToBody";
import SceneBuilder from "webviz-core/src/panels/ThreeDimensionalViz/SceneBuilder";
import { type Topic } from "webviz-core/src/players/types";
import type { Namespace } from "webviz-core/src/types/Messages";
import { colors } from "webviz-core/src/util/colors";

require("rc-collapse/assets/index.css");

const STopicGroupsContainer = styled.div`
  position: absolute;
  top: 15px;
  left: 15px;
  bottom: 15px;
  z-index: 102;
`;

const STopicGroups = styled.div`
  color: ${colors.TEXTL1};
  border-radius: 8px;
  background-color: ${colors.TOOLBAR};
  overflow: auto;
  max-width: 400px;
  max-height: 90%;
  pointer-events: all;
  .rc-collapse {
    background: transparent;
    border-radius: 0;
    border: none;
    padding: 0;
    margin: 0;
    .rc-collapse-item {
      border: none;
      padding: 0;
      margin: 0;
      .rc-collapse-header {
        margin: 0;
        border: none;
        transition: 0.3s;
        padding: 4px 0px 4px 24px;
        color: unset;
        &:hover {
          color: ${colors.LIGHT};
          background-color: ${colors.HOVER_BACKGROUND_COLOR};
          ${STopicGroupName} {
            color: ${colors.YELLOWL1};
          }
          ${SEyeIcon} {
            color: white;
            opacity: 1;
          }
          ${SMenuWrapper} {
            color: white;
            opacity: 1;
          }
        }
      }
      .rc-collapse-content {
        color: unset;
        padding: 0;
        border: none;
        margin: 0;
        background: transparent;
        .rc-collapse-content-box {
          margin: 0;
        }
      }
    }
  }
`;

const SMutedText = styled.div`
  color: ${colors.GRAY};
  line-height: 1.4;
  margin: 8px 12px;
`;

const STopicGroupsHeader = styled.div`
  display: flex;
  padding: 8px;
  align-items: center;
  background-color: ${colors.DARK5};
`;

const SFilter = styled.div`
  display: flex;
  flex: 1;
`;

type SharedProps = {|
  availableTopics: Topic[],
  pinTopics: boolean,
  saveConfig: Save3DConfig,
  sceneBuilder: SceneBuilder,
  topicGroupsConfig: TopicGroupConfig[],
|};
type TopicGroupsBaseProps = {|
  ...SharedProps,
  namespacesByTopic: { [topicName: string]: string[] },
  displayNameByTopic: { [topicName: string]: string },
|};

export function TopicGroupsBase({
  topicGroupsConfig,
  displayNameByTopic = {},
  namespacesByTopic = {},
  availableTopics = [],
  pinTopics,
  saveConfig,
  sceneBuilder,
}: TopicGroupsBaseProps) {
  const [isOpen, setIsOpen] = useState<boolean>(pinTopics);
  const [topicSettingsObjectPath, setTopicSettingsObjectPath] = useState<?string>();
  const modalRef = React.useRef<HTMLDivElement | null>(null);

  const toggleIsOpen = useCallback(() => setIsOpen(!isOpen), [isOpen]);
  const togglePinTopics = useCallback(() => saveConfig({ pinTopics: !pinTopics }), [pinTopics, saveConfig]);

  const topicGroups = getTopicGroups(topicGroupsConfig, {
    displayNameByTopic,
    namespacesByTopic,
    availableTopics,
  });

  const onEditTopicSettingsClick = useCallback((objectPath) => setTopicSettingsObjectPath(objectPath), []);

  const saveNewTopicGroupsToConfig = useCallback(
    (newTopicGroups: TopicGroupType[]) => {
      const newTopicGroupsConfig = compact(newTopicGroups).map((group) => ({
        ...omit(group, "derivedFields"),
        items: compact(group.items).map((item) => omit(item, "derivedFields")),
      }));
      saveConfig({ topicGroups: newTopicGroupsConfig });
    },
    [saveConfig]
  );

  const onCollapseChange = useCallback(
    (activeKeys: string[]) =>
      saveNewTopicGroupsToConfig(
        cloneDeep(topicGroups).map((group) => ({
          ...group,
          expanded: activeKeys.includes(group.derivedFields.id),
        }))
      ),
    [saveNewTopicGroupsToConfig, topicGroups]
  );

  const onTopicGroupsChange = useCallback(
    (objectPath: string, newValue: any) => {
      // Make a deep copy of topicGroups to avoid mutation bugs.
      const newTopicGroups = cloneDeep(topicGroups);
      set(newTopicGroups, objectPath, newValue);
      saveNewTopicGroupsToConfig(newTopicGroups);
    },
    [saveNewTopicGroupsToConfig, topicGroups]
  );

  return (
    <STopicGroupsContainer>
      <div className="webviz-modal" ref={modalRef} />
      {topicSettingsObjectPath &&
        modalRef.current &&
        ReactDOM.createPortal(
          <RenderToBodyComponent>
            <Modal
              onRequestClose={() => setTopicSettingsObjectPath(undefined)}
              contentStyle={{
                maxHeight: "calc(100vh - 200px)",
                maxWidth: 480,
                display: "flex",
                flexDirection: "column",
              }}>
              <TopicSettingsEditor
                objectPath={topicSettingsObjectPath}
                onTopicGroupsChange={onTopicGroupsChange}
                sceneBuilder={sceneBuilder}
                topicGroups={topicGroups}
              />
            </Modal>
          </RenderToBodyComponent>,
          modalRef.current
        )}
      <ChildToggle
        noPortal
        position="below"
        isOpen={isOpen || pinTopics}
        onToggle={toggleIsOpen}
        dataTest="open-topic-picker">
        <Icon tooltip="Topic Picker" medium fade active={isOpen} style={{ color: "white" }}>
          <LayersIcon />
        </Icon>
        <STopicGroups>
          <STopicGroupsHeader>
            <SFilter>{/* TODO(Audrey) */}</SFilter>
            <Icon
              tooltip={pinTopics ? "Unpin Topic Picker" : "Pin Topic Picker"}
              small
              fade
              active={pinTopics}
              onClick={togglePinTopics}
              style={{ color: pinTopics ? colors.HIGHLIGHT : colors.LIGHT }}>
              <PinIcon />
            </Icon>
          </STopicGroupsHeader>
          <SMutedText>
            Topic Group Management is an experimental feature under active development. You can use the existing topic
            tree by selecting <b>Always off</b> in the Experimental Features menu.
          </SMutedText>
          <Collapse
            defaultActiveKey={topicGroups
              .map((group) => (group.expanded ? group.derivedFields.id : undefined))
              .filter(Boolean)}
            expandIcon={({ expanded }) => (
              <Icon medium fade style={{ marginRight: 4 }}>
                {expanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
              </Icon>
            )}
            onChange={onCollapseChange}>
            {topicGroups.map((topicGroup, idx) => (
              <Collapse.Panel
                className={`test-${topicGroup.derivedFields.id}`}
                key={topicGroup.derivedFields.id}
                header={
                  <TopicGroupHeader
                    onTopicGroupsChange={onTopicGroupsChange}
                    topicGroup={topicGroup}
                    objectPath={`[${idx}]`}
                  />
                }>
                {topicGroup.expanded && (
                  <TopicGroupBody
                    key={topicGroup.derivedFields.id}
                    objectPath={`[${idx}]`}
                    topicGroup={topicGroup}
                    onEditTopicSettingsClick={onEditTopicSettingsClick}
                    onTopicGroupsChange={onTopicGroupsChange}
                  />
                )}
              </Collapse.Panel>
            ))}
          </Collapse>
        </STopicGroups>
      </ChildToggle>
    </STopicGroupsContainer>
  );
}

type TopicGroupsProps = {|
  ...SharedProps,
  availableTfs: string[],
  allNamespaces: Namespace[],
|};
// Use the wrapper component to handle top level data processing
export default function TopicGroups({ allNamespaces, availableTfs, ...rest }: TopicGroupsProps) {
  const { configDisplayNameByTopic, configNamespacesByTopic } = useMemo(() => {
    return {
      configDisplayNameByTopic: buildItemDisplayNameByTopicOrExtension(TOPIC_CONFIG),
      configNamespacesByTopic: buildAvailableNamespacesByTopic(TOPIC_CONFIG),
    };
  }, []);

  const namespacesByTopic = useMemo(
    () => {
      const dataSourceNamespacesByTopic = allNamespaces.reduce((memo, { name, topic }) => {
        memo[topic] = memo[topic] || [];
        memo[topic].push(name);
        return memo;
      }, {});
      return {
        ...dataSourceNamespacesByTopic,
        ...configNamespacesByTopic,
        ...(availableTfs.length ? { "/tf": availableTfs } : undefined),
      };
    },
    [allNamespaces, availableTfs, configNamespacesByTopic]
  );

  return (
    <TopicGroupsBase displayNameByTopic={configDisplayNameByTopic} namespacesByTopic={namespacesByTopic} {...rest} />
  );
}
