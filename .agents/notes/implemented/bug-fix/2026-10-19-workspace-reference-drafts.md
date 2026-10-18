# Workspace draft transfer preserves references

Status: implemented

## Problem

Workspace switching copied the input shell's display draft. Reference chips carry shorter labels in that string, so a session or file URI could be replaced with its label even though normal persisted-draft restoration already used canonical clipboard text.

## Decision

Workspace transfer reads the input shell's canonical draft export, using the same projection as persistence. The target receives resolvable reference text; source clearing and image ownership keep their existing transaction order. Historical editing and EasyRewrite are unchanged.

## Verification

The input-reference suite transfers a live reference chip to a fresh workspace shell and checks the submitted URI, not only its visible label.
